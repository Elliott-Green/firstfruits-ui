<script lang="ts">
	import { Contract, formatEther, parseEther } from 'ethers';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';
	import { page } from '$app/state';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { account, openConnectModal } from '$lib/wallet.svelte';
	import { FIRSTFRUITS_ADDRESS, RETH_ADDRESS, firstfruitsAbi, BPS_DENOMINATOR } from '$lib/contracts/firstfruits';
	import { erc20Abi } from '$lib/contracts/erc20';
	import { getVaultWithSigner, getRethWithSigner } from '$lib/contracts/signer';
	import ApyCard from '$lib/components/ApyCard.svelte';
	import { fetchLatestCauses, fetchPatronTotalDonatedReth } from '$lib/subgraph';
	import { fetchUsdPrices, convertRethToUsd, formatUsd, type UsdPrices } from '$lib/prices';
	import { fetchRethExchangeRate } from '$lib/contracts/reth';
	import { getContractErrorMessage } from '$lib/errors';
	import { ogImageUrl } from '$lib/og';

	const PAGE_TITLE = 'Dashboard';
	const PAGE_DESCRIPTION = 'Deposit ETH or rETH, choose your cause splits, and harvest yield - manage your Firstfruits vault position.';

	let { data } = $props();
	const metaTags = $derived.by(() => {
		const image = ogImageUrl(page.url.origin, PAGE_TITLE, PAGE_DESCRIPTION);
		return deepMerge(data.baseMetaTags, {
			title: PAGE_TITLE,
			description: PAGE_DESCRIPTION,
			openGraph: { title: PAGE_TITLE, images: [{ url: image, width: 1200, height: 630, alt: PAGE_TITLE }] },
			twitter: { title: PAGE_TITLE, image }
		});
	});

	type Position = {
		rethBalance: bigint;
		principalEther: bigint;
		bankedReth: bigint;
	};

	type CauseOption = {
		id: bigint;
		name: string;
		active: boolean;
	};

	type Split = {
		causeId: bigint;
		name: string;
		bps: number;
	};

	// An ETH deposit goes straight into RocketPool's deposit pool (see
	// _depositEther in the vault), which enforces its own minimum - currently
	// 0.01 ETH. Below that, the tx reverts on RocketPool's side, not ours.
	// Only applies to ETH deposits: rETH deposits are a plain token transfer
	// into the vault and never touch RocketPool's deposit pool.
	const ROCKET_POOL_MIN_DEPOSIT_WEI = parseEther('0.01');

	let position = $state<Position | undefined>(undefined);
	let pendingYieldReth = $state<bigint | undefined>(undefined);
	let withdrawableEth = $state<bigint | undefined>(undefined);
	let walletEthBalance = $state<bigint | undefined>(undefined);
	let walletRethBalance = $state<bigint | undefined>(undefined);
	let rethAllowance = $state<bigint | undefined>(undefined);
	// Lifetime total, from the subgraph - best-effort, not required for the
	// rest of the page to work if it's slow or unreachable.
	let totalDonatedReth = $state<bigint | undefined>(undefined);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	// Global (not per-account) - fetched once on mount.
	let usdPrices = $state<UsdPrices>({ ethUsd: undefined });
	// rETH → ETH redemption rate, for pricing rETH amounts in USD (see
	// convertRethToUsd's doc comment for why this isn't just a quoted rETH price).
	let exchangeRate = $state<bigint | undefined>(undefined);

	function formatAmount(wei: bigint): string {
		return Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 8 });
	}

	function ethUsd(wei: bigint): string | undefined {
		if (usdPrices.ethUsd === undefined) return undefined;
		return formatUsd(Number(formatEther(wei)) * usdPrices.ethUsd);
	}

	function rethUsd(wei: bigint): string | undefined {
		if (usdPrices.ethUsd === undefined || exchangeRate === undefined) return undefined;
		return formatUsd(convertRethToUsd(wei, exchangeRate, usdPrices.ethUsd));
	}

	function loadPrices() {
		fetchUsdPrices()
			.then((p) => (usdPrices = p))
			.catch(() => {});
		fetchRethExchangeRate()
			.then((r) => (exchangeRate = r))
			.catch(() => {});
	}

	// Bumped on every loadPosition/loadSplits call and captured locally so a
	// slower, older fetch (e.g. from just before an account switch) can't win
	// a race and overwrite fresher results with stale data.
	let positionRequestId = 0;
	let splitsRequestId = 0;

	// One shared modal for every action error (deposit/withdraw/harvest/save)
	// instead of five separate inline messages.
	let errorModalMessage = $state<string | undefined>(undefined);

	// Only causes the patron has actually allocated to ever get a slider row -
	// this is what keeps the editor usable at 100+ causes in the catalog. The
	// full catalog (allCauses) only backs the search-to-add box below, never
	// renders as a list of its own.
	let splits = $state<Split[]>([]);
	let splitsLoading = $state(false);
	let saving = $state(false);
	let saveSuccess = $state(false);

	let allCauses = $state<CauseOption[]>([]);
	let addCauseQuery = $state('');
	let addCauseFocused = $state(false);

	const totalBps = $derived(splits.reduce((sum, s) => sum + s.bps, 0));
	const bpsDenominator = Number(BPS_DENOMINATOR);
	const currentAllocations = $derived(
		splits
			.filter((s) => s.bps > 0)
			.sort((a, b) => (a.causeId < b.causeId ? -1 : 1))
			.map((s) => ({ causeId: s.causeId, bps: s.bps }))
	);

	// Drives both the "Save Splits" button's visibility and the getting-started
	// wizard below - a patron with nothing withdrawable hasn't deposited yet,
	// so "Save Splits" alone would just be a no-op designate() with no stake
	// behind it, and easy to confuse with the Deposit button (which already
	// re-saves splits in the same transaction).
	const hasWithdrawableBalance = $derived((withdrawableEth ?? 0n) > 0n);

	type WizardStatus = 'done' | 'active' | 'upcoming';
	const wizardSplitsDone = $derived(splits.length > 0 && totalBps === bpsDenominator);
	const wizardDepositDone = $derived(hasWithdrawableBalance);
	const wizardHarvestDone = $derived((totalDonatedReth ?? 0n) > 0n);
	// Manually dismissable (and remembered per-address in localStorage) on top
	// of auto-hiding once they've actually harvested - someone might not want
	// it staring at them before then either.
	let wizardDismissed = $state(false);
	const showWizard = $derived(!wizardHarvestDone && !wizardDismissed);
	const wizardSplitsStatus = $derived<WizardStatus>(wizardSplitsDone ? 'done' : 'active');
	const wizardDepositStatus = $derived<WizardStatus>(wizardDepositDone ? 'done' : wizardSplitsDone ? 'active' : 'upcoming');
	const wizardHarvestStatus = $derived<WizardStatus>(wizardHarvestDone ? 'done' : wizardDepositDone ? 'active' : 'upcoming');

	function wizardDismissKey(address: string): string {
		return `firstfruits:wizard-dismissed:${address.toLowerCase()}`;
	}

	function dismissWizard() {
		wizardDismissed = true;
		if (!account.address) return;
		try {
			localStorage.setItem(wizardDismissKey(account.address), 'true');
		} catch {
			// Private browsing or storage disabled - dismissal just won't
			// survive a reload, which is a fine fallback.
		}
	}

	// Shows suggestions as soon as the box is focused (a real dropdown, not
	// just a filter that only appears once you start typing) - with a query,
	// it filters by name; without one, it's just the first few not-yet-added
	// causes.
	const addCauseResults = $derived.by(() => {
		const q = addCauseQuery.trim().toLowerCase();
		const shownIds = new Set(splits.map((s) => s.causeId));
		const pool = allCauses.filter((c) => c.active && !shownIds.has(c.id));
		const filtered = q ? pool.filter((c) => c.name.toLowerCase().includes(q)) : pool;
		return filtered.slice(0, 8);
	});

	function addCause(cause: CauseOption) {
		splits = [...splits, { causeId: cause.id, name: cause.name, bps: 0 }];
		addCauseQuery = '';
	}

	function removeCause(causeId: bigint) {
		splits = splits.filter((s) => s.causeId !== causeId);
	}

	// Delayed so a click on a dropdown result (which blurs the input first)
	// still registers before the dropdown disappears.
	function handleAddCauseBlur() {
		setTimeout(() => (addCauseFocused = false), 150);
	}

	function maxForSplit(split: Split): number {
		return Math.max(0, bpsDenominator - (totalBps - split.bps));
	}

	// Causes have no logo/image at the contract level, and we're not building
	// a client-side image or category system just to decorate a row - so each
	// avatar is just the cause's own initial in a deterministically hashed
	// color (same idea as AddressAvatarLink's hashed avatar color).
	const CAUSE_COLORS: { bg: string; fg: string }[] = [
		{ bg: 'bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400' },
		{ bg: 'bg-pink-500/10', fg: 'text-pink-600 dark:text-pink-400' },
		{ bg: 'bg-purple-500/10', fg: 'text-purple-600 dark:text-purple-400' },
		{ bg: 'bg-green-500/10', fg: 'text-green-600 dark:text-green-400' },
		{ bg: 'bg-cyan-500/10', fg: 'text-cyan-600 dark:text-cyan-400' },
		{ bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400' }
	];

	function causeColor(causeId: bigint) {
		const idx = Number(((causeId % BigInt(CAUSE_COLORS.length)) + BigInt(CAUSE_COLORS.length)) % BigInt(CAUSE_COLORS.length));
		return CAUSE_COLORS[idx];
	}

	let depositToken = $state<'eth' | 'reth'>('eth');
	let depositAmount = $state('');
	let depositing = $state(false);
	let depositStep = $state<'' | 'approving' | 'depositing'>('');
	let depositSuccess = $state(false);

	let withdrawToken = $state<'eth' | 'reth'>('eth');
	let withdrawAmount = $state('');
	let withdrawing = $state(false);
	let withdrawSuccess = $state(false);

	const canWithdraw = $derived(withdrawToken === 'eth' ? (withdrawableEth ?? 0n) > 0n : (position?.rethBalance ?? 0n) > 0n);

	// Whether the balance "Max" needs is actually loaded yet - used to disable
	// the button instead of it silently doing nothing when clicked too early.
	const depositMaxReady = $derived(depositToken === 'eth' ? walletEthBalance !== undefined : walletRethBalance !== undefined);
	const withdrawMaxReady = $derived(withdrawToken === 'eth' ? withdrawableEth !== undefined : position !== undefined);

	function setDepositToken(token: 'eth' | 'reth') {
		depositToken = token;
		// Otherwise a Max amount (or anything typed) for the old token carries
		// over and gets submitted against the new one.
		depositAmount = '';
	}

	function setWithdrawToken(token: 'eth' | 'reth') {
		withdrawToken = token;
		withdrawAmount = '';
	}

	let harvesting = $state(false);
	let harvestSuccess = $state(false);

	async function loadPosition(patron: string) {
		if (!FIRSTFRUITS_ADDRESS) return;
		// Captured so a slower, older call (e.g. from just before the wallet
		// switched accounts) can detect it's been superseded and bail instead of
		// overwriting the newer, correct values - this is what made balances
		// intermittently show stale/wrong-account data.
		const requestId = ++positionRequestId;
		loading = true;
		error = undefined;
		try {
			const provider = getActiveProvider();
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, provider);
			const reth = RETH_ADDRESS ? new Contract(RETH_ADDRESS, erc20Abi, provider) : undefined;

			const [[rethBalance, principalEther, bankedReth], [rethAmount], withdrawable, ethBalance, rethBal, allowance, donated] =
				await Promise.all([
					vault.patrons(patron),
					vault.pendingYield(patron),
					vault.withdrawableEther(patron),
					provider.getBalance(patron),
					// Caught individually - a hiccup reading the rETH token
					// shouldn't blank out the ETH-side balances too.
					reth?.balanceOf(patron).catch(() => undefined) ?? Promise.resolve(undefined),
					reth?.allowance(patron, FIRSTFRUITS_ADDRESS).catch(() => undefined) ?? Promise.resolve(undefined),
					fetchPatronTotalDonatedReth(patron).catch(() => undefined)
				]);

			if (requestId !== positionRequestId) return; // superseded by a newer request

			position = { rethBalance, principalEther, bankedReth };
			pendingYieldReth = rethAmount;
			withdrawableEth = withdrawable;
			walletEthBalance = ethBalance;
			walletRethBalance = rethBal;
			rethAllowance = allowance;
			totalDonatedReth = donated;
		} catch (e) {
			if (requestId !== positionRequestId) return;
			error = e instanceof Error ? e.message : 'Failed to load position.';
		} finally {
			if (requestId === positionRequestId) loading = false;
		}
	}

	async function loadSplits(patron: string) {
		if (!FIRSTFRUITS_ADDRESS) return;
		const requestId = ++splitsRequestId;
		splitsLoading = true;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());

			// Only resolve names for the patron's OWN allocations (bounded by
			// MAX_ALLOCATIONS, effectively single digits in practice) - never for
			// every cause in the vault, which is what made this unusable at scale.
			const allocations = (await vault.allocationsOf(patron)) as { causeId: bigint; bps: bigint }[];
			const resolvedSplits = await Promise.all(
				allocations
					.filter((a) => a.bps > 0n)
					.map(async (a) => {
						const [, , , , name] = await vault.causes(a.causeId);
						return { causeId: a.causeId, name, bps: Number(a.bps) };
					})
			);

			// The full catalog, for the search-to-add box only - one indexed
			// subgraph query rather than N contract calls, so this stays cheap
			// no matter how many causes exist.
			let resolvedAllCauses: CauseOption[] = [];
			try {
				const list = await fetchLatestCauses(500);
				resolvedAllCauses = list.map((c) => ({ id: BigInt(c.causeId), name: c.name, active: true }));
			} catch {
				resolvedAllCauses = [];
			}

			if (requestId !== splitsRequestId) return; // superseded by a newer request
			splits = resolvedSplits;
			allCauses = resolvedAllCauses;
		} catch {
			if (requestId !== splitsRequestId) return;
			// Leave splits empty; the editor will just show nothing to allocate.
		} finally {
			if (requestId === splitsRequestId) splitsLoading = false;
		}
	}

	async function refreshAll() {
		if (!account.address) return;
		await Promise.all([loadPosition(account.address), loadSplits(account.address)]);
	}

	async function saveSplits() {
		saving = true;
		saveSuccess = false;
		try {
			const vault = await getVaultWithSigner();
			const tx = await vault.designate(currentAllocations);
			await tx.wait();
			saveSuccess = true;
			await refreshAll();
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Failed to save splits.');
		} finally {
			saving = false;
		}
	}

	function setMaxDeposit() {
		if (depositToken === 'eth') {
			if (walletEthBalance === undefined) return;
			depositAmount = formatEther(walletEthBalance);
		} else {
			if (walletRethBalance === undefined) return;
			depositAmount = formatEther(walletRethBalance);
		}
	}

	function setMaxWithdraw() {
		if (withdrawToken === 'eth') {
			if (withdrawableEth === undefined) return;
			withdrawAmount = formatEther(withdrawableEth);
		} else {
			if (position === undefined) return;
			withdrawAmount = formatEther(position.rethBalance);
		}
	}

	async function deposit() {
		depositSuccess = false;
		let amountWei: bigint;
		try {
			amountWei = parseEther(depositAmount || '0');
		} catch {
			errorModalMessage = 'Enter a valid amount.';
			return;
		}
		if (amountWei <= 0n) {
			errorModalMessage = 'Enter an amount greater than 0.';
			return;
		}
		if (depositToken === 'eth' && amountWei < ROCKET_POOL_MIN_DEPOSIT_WEI) {
			errorModalMessage = `RocketPool requires a minimum deposit of ${formatEther(ROCKET_POOL_MIN_DEPOSIT_WEI)} ETH.`;
			return;
		}

		depositing = true;
		try {
			if (depositToken === 'eth') {
				depositStep = 'depositing';
				const vault = await getVaultWithSigner();
				const tx = await vault.depositAndDesignate(currentAllocations, { value: amountWei });
				await tx.wait();
			} else {
				if (!FIRSTFRUITS_ADDRESS) throw new Error('Vault address is not configured.');
				if (!account.address) throw new Error('No wallet connected.');
				const reth = await getRethWithSigner();
				const allowance: bigint = await reth.allowance(account.address, FIRSTFRUITS_ADDRESS);
				if (allowance < amountWei) {
					depositStep = 'approving';
					const approveTx = await reth.approve(FIRSTFRUITS_ADDRESS, amountWei);
					await approveTx.wait();
				}
				depositStep = 'depositing';
				const vault = await getVaultWithSigner();
				const tx = await vault.depositRethAndDesignate(amountWei, currentAllocations);
				await tx.wait();
			}
			depositSuccess = true;
			depositAmount = '';
			await refreshAll();
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Deposit failed.');
		} finally {
			depositing = false;
			depositStep = '';
		}
	}

	async function withdraw() {
		withdrawSuccess = false;
		let amountWei: bigint;
		try {
			amountWei = parseEther(withdrawAmount || '0');
		} catch {
			errorModalMessage = 'Enter a valid amount.';
			return;
		}
		if (amountWei <= 0n) {
			errorModalMessage = 'Enter an amount greater than 0.';
			return;
		}

		withdrawing = true;
		try {
			const vault = await getVaultWithSigner();
			const tx = withdrawToken === 'eth' ? await vault.withdraw(amountWei) : await vault.withdrawReth(amountWei);
			await tx.wait();
			withdrawSuccess = true;
			withdrawAmount = '';
			await refreshAll();
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Withdrawal failed.');
		} finally {
			withdrawing = false;
		}
	}

	async function harvest() {
		harvestSuccess = false;
		harvesting = true;
		try {
			if (!account.address) return;
			const vault = await getVaultWithSigner();
			const tx = await vault.harvest(account.address);
			await tx.wait();
			harvestSuccess = true;
			await refreshAll();
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Harvest failed.');
		} finally {
			harvesting = false;
		}
	}

	$effect(() => {
		if (account.address) {
			loadPosition(account.address);
			loadSplits(account.address);
			try {
				wizardDismissed = localStorage.getItem(wizardDismissKey(account.address)) === 'true';
			} catch {
				wizardDismissed = false;
			}
		} else {
			position = undefined;
			pendingYieldReth = undefined;
			withdrawableEth = undefined;
			walletEthBalance = undefined;
			walletRethBalance = undefined;
			rethAllowance = undefined;
			totalDonatedReth = undefined;
			splits = [];
			wizardDismissed = false;
		}
	});

	$effect(() => {
		loadPrices();
	});
</script>

<MetaTags {...metaTags} />

<div class="px-4 py-8 lg:px-18">
	<h1 class="text-3xl font-bold">Your Vault</h1>
	<p class="mt-1 text-sm opacity-60">Grow your impact. Earn yield. Support causes.</p>

	{#if !account.isConnected}
		<div class="mt-6 flex flex-col items-center gap-4 card p-10 text-center">
			<p class="opacity-75">Connect your wallet to view your position and deposit.</p>
			<button type="button" class="btn preset-tonal" onclick={openConnectModal}> Connect wallet </button>
		</div>
	{:else if !FIRSTFRUITS_ADDRESS}
		<div class="mt-6 card p-10 text-center opacity-75">
			The vault hasn't been deployed yet - set <code>VITE_FIRSTFRUITS_ADDRESS</code> once it is.
		</div>
	{:else}
		{#snippet tokenIcon(token: 'eth' | 'reth')}
			{#if token === 'eth'}
				<svg viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3">
					<path d="M12 1.75 5 12.25l7 4.15 7-4.15z" />
					<path d="M12 1.75v10.65l7-4.15z" opacity="0.6" />
					<path d="M12 22.25v-6.15l-7-4.1z" />
					<path d="M12 22.25v-6.15l7-4.1z" opacity="0.6" />
				</svg>
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-3 w-3"
				>
					<path d="M12 2c2.5 2 4 5.5 4 9 0 2-1 4-4 6-3-2-4-4-4-6 0-3.5 1.5-7 4-9Z" />
					<path d="M9 15l-2 4 3-1" />
					<path d="M15 15l2 4-3-1" />
				</svg>
			{/if}
		{/snippet}

		{#snippet balanceChip(token: 'eth' | 'reth', label: string, value: string)}
			<div class="flex items-center gap-2 rounded-full bg-surface-200-800 py-1.5 pr-3 pl-1.5 text-xs">
				<span
					class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full {token === 'eth'
						? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
						: 'bg-orange-500/15 text-orange-600 dark:text-orange-400'}"
				>
					{@render tokenIcon(token)}
				</span>
				<span class="opacity-60">{label}</span>
				<span class="ml-auto font-medium">{value}</span>
			</div>
		{/snippet}

		{#snippet wizardStep(num: number, title: string, body: string, status: WizardStatus, align: 'start' | 'center' | 'end')}
			<div
				class="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-3 text-center"
				class:sm:items-start={align === 'start'}
				class:sm:items-end={align === 'end'}
				class:sm:text-left={align === 'start'}
				class:sm:text-right={align === 'end'}
			>
				<span class="relative flex h-11 w-11 shrink-0 items-center justify-center">
					{#if status === 'active'}
						<span class="absolute inset-0 animate-ping rounded-full bg-primary-500 opacity-75"></span>
						<span class="absolute -inset-1.5 rounded-full ring-4 ring-primary-500/25"></span>
					{/if}
					<span
						class="relative flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold"
						class:bg-green-500={status === 'done'}
						class:text-white={status === 'done' || status === 'active'}
						class:bg-primary-500={status === 'active'}
						class:bg-surface-100-900={status === 'upcoming'}
						class:ring-4={status === 'upcoming'}
						class:ring-surface-200-800={status === 'upcoming'}
						class:opacity-60={status === 'upcoming'}
					>
						{status === 'done' ? '✓' : num}
					</span>
				</span>
				<div class="min-w-0">
					<p
						class="text-xs font-bold tracking-wide uppercase {status === 'done'
							? 'text-green-600 dark:text-green-400'
							: status === 'active'
								? 'text-primary-600-400'
								: 'opacity-40'}"
					>
						Step {num}
					</p>
					<p class="mt-1 text-base font-semibold" class:opacity-50={status === 'upcoming'}>{title}</p>
					<p class="mt-1 text-sm opacity-60" class:opacity-40={status === 'upcoming'}>{body}</p>
					<span
						class="mt-2 inline-block rounded-full px-2 py-0.5 text-sm font-medium {status === 'done'
							? 'bg-green-500/10 text-green-600 dark:text-green-400'
							: status === 'active'
								? 'bg-primary-500/10 text-primary-600-400'
								: 'bg-surface-200-800 opacity-60'}"
					>
						{status === 'done' ? 'Completed' : status === 'active' ? 'In progress' : 'Upcoming'}
					</span>
				</div>
			</div>
		{/snippet}

		{#if showWizard}
			<div class="mt-6 card bg-surface-100-900 p-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold">Getting started</h2>
						<p class="mt-0.5 text-sm opacity-60">Complete these steps to start earning yield for the causes you care about.</p>
					</div>
					<button
						type="button"
						class="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm opacity-60 hover:opacity-100"
						title="Dismiss"
						aria-label="Dismiss getting-started guide"
						onclick={dismissWizard}
					>
						Hide
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="m18 15-6-6-6 6" />
						</svg>
					</button>
				</div>
				<!-- The line sits behind the steps (z-0 vs. their z-10) at the circles'
				     vertical center (22px = half of h-11). Step 1/3 anchor their content
				     to the row's own edges (not centered in an equal third) so circle 1's
				     center sits a fixed 22px from the left edge and circle 3's a fixed
				     22px from the right - using the full card width instead of the empty
				     margin equal-thirds centering left on each side. Circle 2 stays
				     centered in the middle column, which lands it at exactly 50%. -->
				<div class="relative mt-6 hidden sm:block">
					<div
						class="absolute top-[22px] left-[22px] h-1 w-[calc(50%-22px)] rounded-full"
						class:bg-green-500={wizardSplitsDone}
						class:bg-surface-200-800={!wizardSplitsDone}
					></div>
					<div
						class="absolute top-[22px] left-1/2 h-1 w-[calc(50%-22px)] rounded-full"
						class:bg-green-500={wizardDepositDone}
						class:bg-surface-200-800={!wizardDepositDone}
					></div>
					<div class="flex">
						{@render wizardStep(1, 'Choose cause splits', 'Add causes below until they add up to 100%.', wizardSplitsStatus, 'start')}
						{@render wizardStep(
							2,
							'Deposit ETH or rETH',
							'Stake into the vault - this saves your splits too.',
							wizardDepositStatus,
							'center'
						)}
						{@render wizardStep(
							3,
							'Harvest when ready',
							'Once yield has accrued, harvest to send it to your causes.',
							wizardHarvestStatus,
							'end'
						)}
					</div>
				</div>
				<div class="mt-6 flex flex-col gap-6 sm:hidden">
					{@render wizardStep(1, 'Choose cause splits', 'Add causes below until they add up to 100%.', wizardSplitsStatus, 'center')}
					{@render wizardStep(
						2,
						'Deposit ETH or rETH',
						'Stake into the vault - this saves your splits too.',
						wizardDepositStatus,
						'center'
					)}
					{@render wizardStep(
						3,
						'Harvest when ready',
						'Once yield has accrued, harvest to send it to your causes.',
						wizardHarvestStatus,
						'center'
					)}
				</div>
			</div>
		{/if}

		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex flex-col card bg-surface-100-900 p-6">
				<p class="text-sm opacity-60">Withdrawable principal</p>
				<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<p class="text-3xl font-semibold tracking-tight whitespace-nowrap text-blue-600 dark:text-blue-400">
						{position ? formatAmount(position.principalEther) : loading ? '…' : '0'} ETH
					</p>
					{#if position && ethUsd(position.principalEther)}
						<p class="text-sm opacity-50">{ethUsd(position.principalEther)}</p>
					{/if}
				</div>
				<p class="mt-auto pt-2 text-xs opacity-50">Always yours to withdraw</p>
			</div>
			<div class="flex flex-col card bg-surface-100-900 p-6">
				<p class="text-sm opacity-60">rETH held</p>
				<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<p class="text-3xl font-semibold tracking-tight whitespace-nowrap text-orange-600 dark:text-orange-400">
						{position ? formatAmount(position.rethBalance) : loading ? '…' : '0'} rETH
					</p>
					{#if position && rethUsd(position.rethBalance)}
						<p class="text-sm opacity-50">{rethUsd(position.rethBalance)}</p>
					{/if}
				</div>
				<p class="mt-auto pt-2 text-xs opacity-50">Staked balance earning yield</p>
			</div>
			<div class="flex flex-col card bg-surface-100-900 p-6">
				<p class="text-sm opacity-60">Pending yield (unharvested)</p>
				<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<p class="text-3xl font-semibold tracking-tight whitespace-nowrap text-green-600 dark:text-green-400">
						{pendingYieldReth !== undefined ? formatAmount(pendingYieldReth) : loading ? '…' : '0'} rETH
					</p>
					{#if pendingYieldReth !== undefined && rethUsd(pendingYieldReth)}
						<p class="text-sm opacity-50">{rethUsd(pendingYieldReth)}</p>
					{/if}
				</div>
				<div class="flex place-content-between">
					<p
						class="mt-auto pt-2 text-xs"
						class:text-green-600={harvestSuccess}
						class:dark:text-green-400={harvestSuccess}
						class:opacity-50={!harvestSuccess}
					>
						{harvestSuccess ? 'Harvested - yield routed to your causes.' : 'Routes straight to your causes on harvest.'}
					</p>
					<button type="button" class="btn preset-tonal btn-sm" disabled={harvesting || !pendingYieldReth} onclick={harvest}>
						{harvesting ? 'Harvesting…' : 'Harvest'}
					</button>
				</div>
			</div>
			<div class="flex flex-col card bg-surface-100-900 p-6">
				<p class="text-sm opacity-60">Total donated</p>
				<div class="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<p class="text-3xl font-semibold tracking-tight whitespace-nowrap text-green-600 dark:text-green-400">
						{totalDonatedReth !== undefined ? formatAmount(totalDonatedReth) : loading ? '…' : '0'} rETH
					</p>
					{#if totalDonatedReth !== undefined && rethUsd(totalDonatedReth)}
						<p class="text-sm opacity-50">{rethUsd(totalDonatedReth)}</p>
					{/if}
				</div>
				<p class="mt-auto pt-2 text-xs opacity-50">Lifetime yield routed to your causes</p>
			</div>
		</div>

		{#if error}
			<p class="mt-4 text-sm text-red-500">{error}</p>
		{/if}

		<!-- Cause allocation editor - comes before Deposit/Withdraw since both
		     deposit forms fold the splits set here into the same transaction. -->
		<div class="mt-8 card bg-surface-100-900 p-6">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">Your Cause Allocations</h2>
				<p class="text-sm opacity-60">Must add up to {bpsDenominator} bps (100%) - no undesignated leftover</p>
			</div>

			<!-- Search-to-add: the catalog can be 100+ causes, but only the ones
			     you've actually allocated to (below) ever get their own row. -->
			<div class="relative mt-4">
				<input
					type="text"
					placeholder="Search causes to add…"
					bind:value={addCauseQuery}
					onfocus={() => (addCauseFocused = true)}
					onblur={handleAddCauseBlur}
					class="input w-full"
					disabled={splitsLoading}
				/>
				{#if addCauseFocused && addCauseResults.length > 0}
					<div class="absolute z-10 mt-1 w-full card border border-surface-200-800 bg-surface-50-950 p-1 shadow-lg">
						{#each addCauseResults as cause (cause.id)}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-100-900"
								onclick={() => addCause(cause)}
							>
								{cause.name}
							</button>
						{/each}
					</div>
				{:else if addCauseFocused && addCauseQuery.trim() && !splitsLoading}
					<div class="absolute z-10 mt-1 w-full card border border-surface-200-800 bg-surface-50-950 p-3 text-sm opacity-50">
						No matching causes.
					</div>
				{/if}
			</div>

			{#if splitsLoading}
				<p class="mt-4 text-sm opacity-50">Loading your allocations…</p>
			{:else if splits.length === 0}
				<p class="mt-4 text-sm opacity-50">You haven't allocated to any causes yet - search above to add one.</p>
			{:else}
				<div class="mt-4 flex flex-col gap-4">
					{#each splits as split (split.causeId)}
						{@const color = causeColor(split.causeId)}
						{@const maxForThis = maxForSplit(split)}
						<div>
							<div class="flex items-center gap-3">
								<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold {color.bg} {color.fg}">
									{split.name.charAt(0).toUpperCase()}
								</span>
								<span class="min-w-0 flex-1 truncate text-sm font-medium">{split.name}</span>
								<span class="shrink-0 text-sm opacity-60">{split.bps} bps</span>
								<span class="shrink-0 rounded-md bg-surface-100-900 px-2 py-0.5 text-xs font-medium">
									{(split.bps / 100).toFixed(1)}%
								</span>
								<button
									type="button"
									class="shrink-0 opacity-50 hover:opacity-100"
									title="Remove {split.name}"
									aria-label="Remove {split.name}"
									onclick={() => removeCause(split.causeId)}
								>
									✕
								</button>
							</div>
							<input
								type="range"
								min="0"
								max={maxForThis}
								step="100"
								bind:value={split.bps}
								title={maxForThis < bpsDenominator
									? `Free up ${bpsDenominator - maxForThis} bps elsewhere to raise this further`
									: undefined}
								class="mt-2 ml-11 w-[calc(100%-2.75rem)] accent-[var(--color-surface-950-50)]"
							/>
						</div>
					{/each}
				</div>

				<div class="mt-4 flex items-center justify-between border-t pt-4 text-sm">
					<span>Total</span>
					<span
						class:text-red-500={totalBps !== bpsDenominator}
						class:text-green-600={totalBps === bpsDenominator}
						class:dark:text-green-400={totalBps === bpsDenominator}
					>
						{totalBps} / {bpsDenominator} bps
						{#if totalBps !== bpsDenominator}
							({totalBps < bpsDenominator ? bpsDenominator - totalBps : totalBps - bpsDenominator}
							{totalBps < bpsDenominator ? 'remaining' : 'over'})
						{/if}
					</span>
				</div>

				{#if saveSuccess}
					<p class="mt-2 text-sm text-green-600 dark:text-green-400">Splits saved.</p>
				{/if}

				{#if hasWithdrawableBalance}
					<button
						type="button"
						class="mt-4 btn w-full justify-center preset-tonal"
						disabled={saving || totalBps !== bpsDenominator}
						onclick={saveSplits}
					>
						{saving ? 'Saving…' : 'Save splits'}
					</button>
				{:else}
					<p class="mt-4 text-center text-xs opacity-50">
						Depositing below saves these splits too - there's nothing to save on its own until you've deposited.
					</p>
				{/if}
			{/if}
		</div>

		<div class="mt-8 grid gap-4 lg:grid-cols-2">
			<!-- Deposit -->
			<div class="card bg-surface-100-900 p-6">
				<h2 class="font-semibold">Deposit</h2>
				<p class="mt-1 text-xs opacity-60">Deposits and saves the splits above in one transaction - they must add up to 100% first.</p>

				<div class="mt-4 flex items-start justify-between gap-3">
					<div class="inline-flex shrink-0 rounded-full bg-surface-200-800 p-1">
						<button
							type="button"
							class="rounded-full px-4 py-1 text-sm font-medium transition-colors"
							class:bg-surface-50-950={depositToken === 'eth'}
							class:shadow-sm={depositToken === 'eth'}
							class:opacity-60={depositToken !== 'eth'}
							onclick={() => setDepositToken('eth')}
						>
							ETH
						</button>
						<button
							type="button"
							class="rounded-full px-4 py-1 text-sm font-medium transition-colors"
							class:bg-surface-50-950={depositToken === 'reth'}
							class:shadow-sm={depositToken === 'reth'}
							class:opacity-60={depositToken !== 'reth'}
							onclick={() => setDepositToken('reth')}
						>
							rETH
						</button>
					</div>

					<div class="flex flex-wrap items-start justify-end gap-1.5">
						{@render balanceChip(
							depositToken,
							'Wallet balance',
							depositToken === 'eth'
								? walletEthBalance !== undefined
									? `${formatEther(walletEthBalance)} ETH`
									: '…'
								: walletRethBalance !== undefined
									? `${formatEther(walletRethBalance)} rETH`
									: '…'
						)}
						{#if depositToken === 'reth'}
							{@render balanceChip('reth', 'Vault allowance', rethAllowance !== undefined ? `${formatEther(rethAllowance)} rETH` : '…')}
						{/if}
					</div>
				</div>

				<div class="mt-3 flex gap-2">
					<input type="text" inputmode="decimal" placeholder="0.0" bind:value={depositAmount} class="input flex-1" disabled={depositing} />
					<button type="button" class="btn preset-tonal" onclick={setMaxDeposit} disabled={depositing || !depositMaxReady}>Max</button>
				</div>

				{#if depositSuccess}
					<p class="mt-2 text-sm text-green-600 dark:text-green-400">Deposit confirmed.</p>
				{/if}

				<button
					type="button"
					class="mt-4 btn w-full justify-center preset-tonal"
					disabled={depositing || totalBps !== bpsDenominator}
					onclick={deposit}
				>
					{depositing
						? depositStep === 'approving'
							? 'Approving rETH…'
							: 'Depositing…'
						: `Deposit ${depositToken === 'eth' ? 'ETH' : 'rETH'} and save splits`}
				</button>
			</div>

			<!-- Withdraw -->
			<div class="card bg-surface-100-900 p-6">
				<h2 class="font-semibold">Withdraw</h2>
				<p class="mt-1 text-xs opacity-60">Your principal, in either form - always yours, anytime.</p>

				<div class="mt-4 flex items-start justify-between gap-3">
					<div class="inline-flex shrink-0 rounded-full bg-surface-200-800 p-1">
						<button
							type="button"
							class="rounded-full px-4 py-1 text-sm font-medium transition-colors"
							class:bg-surface-50-950={withdrawToken === 'eth'}
							class:shadow-sm={withdrawToken === 'eth'}
							class:opacity-60={withdrawToken !== 'eth'}
							onclick={() => setWithdrawToken('eth')}
						>
							ETH
						</button>
						<button
							type="button"
							class="rounded-full px-4 py-1 text-sm font-medium transition-colors"
							class:bg-surface-50-950={withdrawToken === 'reth'}
							class:shadow-sm={withdrawToken === 'reth'}
							class:opacity-60={withdrawToken !== 'reth'}
							onclick={() => setWithdrawToken('reth')}
						>
							rETH
						</button>
					</div>

					{@render balanceChip(
						withdrawToken,
						'Withdrawable',
						withdrawToken === 'eth'
							? withdrawableEth !== undefined
								? `${formatEther(withdrawableEth)} ETH`
								: '…'
							: position !== undefined
								? `${formatEther(position.rethBalance)} rETH`
								: '…'
					)}
				</div>

				<div class="mt-3 flex gap-2">
					<input
						type="text"
						inputmode="decimal"
						placeholder="0.0"
						bind:value={withdrawAmount}
						class="input flex-1"
						disabled={withdrawing}
					/>
					<button type="button" class="btn preset-tonal" onclick={setMaxWithdraw} disabled={withdrawing || !withdrawMaxReady}>Max</button>
				</div>

				{#if withdrawSuccess}
					<p class="mt-2 text-sm text-green-600 dark:text-green-400">Withdrawal confirmed.</p>
				{/if}

				<button type="button" class="mt-4 btn w-full justify-center preset-tonal" disabled={withdrawing || !canWithdraw} onclick={withdraw}>
					{withdrawing ? 'Withdrawing…' : `Withdraw ${withdrawToken === 'eth' ? 'ETH' : 'rETH'}`}
				</button>
			</div>
		</div>
	{/if}
</div>

<Dialog
	open={errorModalMessage !== undefined}
	onOpenChange={(d: { open: boolean }) => {
		if (!d.open) errorModalMessage = undefined;
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<Dialog.Content class="w-full max-w-md card border border-surface-200-800 bg-surface-50-950 p-6">
				<Dialog.Title class="text-lg font-semibold text-red-500">Something went wrong</Dialog.Title>
				<Dialog.Description class="mt-2 text-sm opacity-70">{errorModalMessage}</Dialog.Description>
				<div class="mt-6 flex justify-end">
					<Dialog.CloseTrigger class="btn preset-tonal">Close</Dialog.CloseTrigger>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
