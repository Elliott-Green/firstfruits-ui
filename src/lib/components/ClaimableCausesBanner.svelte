<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { account } from '$lib/wallet.svelte';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { getVaultWithSigner } from '$lib/contracts/signer';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
	import { fetchRethExchangeRate } from '$lib/contracts/reth';
	import { fetchUsdPrices, convertRethToEth, formatUsd, type UsdPrices } from '$lib/prices';
	import { getContractErrorMessage } from '$lib/errors';

	type ClaimableCause = {
		id: string;
		name: string;
		claimableReth: bigint;
	};

	let claimableCauses = $state<ClaimableCause[]>([]);
	let usdPrices = $state<UsdPrices>({ ethUsd: undefined });
	let exchangeRate = $state<bigint | undefined>(undefined);
	let claimingCauseId = $state<string | undefined>(undefined);
	let errorModalMessage = $state<string | undefined>(undefined);

	// Only the causes this wallet is the *recipient* of - this is deliberately
	// not "owner", per the ask: claiming is a recipient concern, and managing
	// status/recipient (the causes-page cards) is a separate, owner concern.
	async function loadClaimableCauses(recipientAddress: string) {
		if (!FIRSTFRUITS_ADDRESS) {
			claimableCauses = [];
			return;
		}
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const nextCauseId: bigint = await vault.nextCauseId();
			const ids = Array.from({ length: Number(nextCauseId) - 1 }, (_, i) => BigInt(i + 1));
			const rows = await Promise.all(
				ids.map(async (id) => {
					const [, , recipient, , name, claimableReth] = await vault.causes(id);
					return { id: id.toString(), name: name as string, recipient: recipient as string, claimableReth: claimableReth as bigint };
				})
			);
			claimableCauses = rows.filter((c) => c.recipient.toLowerCase() === recipientAddress.toLowerCase() && c.claimableReth > 0n);
		} catch {
			// Best-effort, informational banner - fail quietly rather than
			// breaking every page in the app over it.
			claimableCauses = [];
		}
	}

	function loadPrices() {
		fetchUsdPrices()
			.then((p) => (usdPrices = p))
			.catch(() => {});
		fetchRethExchangeRate()
			.then((r) => (exchangeRate = r))
			.catch(() => {});
	}

	function ethAmount(rethWei: bigint): string | undefined {
		if (exchangeRate === undefined) return undefined;
		return Number(formatEther(convertRethToEth(rethWei, exchangeRate))).toLocaleString(undefined, {
			maximumFractionDigits: 6
		});
	}

	function ethUsdValue(rethWei: bigint): string | undefined {
		if (usdPrices.ethUsd === undefined || exchangeRate === undefined) return undefined;
		const ethWei = convertRethToEth(rethWei, exchangeRate);
		return formatUsd(Number(formatEther(ethWei)) * usdPrices.ethUsd);
	}

	// Ether only, by design - claimReth would let a recipient pull rETH
	// instead, but the ask here is specifically ETH, valued in USD.
	async function claim(cause: ClaimableCause) {
		claimingCauseId = cause.id;
		try {
			const vault = await getVaultWithSigner();
			const tx = await vault.claimEther(cause.id);
			await tx.wait();
			claimableCauses = claimableCauses.filter((c) => c.id !== cause.id);
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Failed to claim.');
		} finally {
			claimingCauseId = undefined;
		}
	}

	$effect(() => {
		if (account.address) {
			loadClaimableCauses(account.address);
			loadPrices();
		} else {
			claimableCauses = [];
		}
	});
</script>

{#if claimableCauses.length > 0}
	<div class="flex flex-col gap-3 border-b border-surface-200-800 bg-primary-500/10 px-4 py-3 lg:px-18">
		{#each claimableCauses as cause (cause.id)}
			{@const eth = ethAmount(cause.claimableReth)}
			{@const usd = ethUsdValue(cause.claimableReth)}
			<div class="flex flex-wrap items-center justify-between gap-3 text-sm">
				<p>
					This wallet is a recipient for the <span class="font-semibold">{cause.name}</span> cause. You are eligible to claim
					<span class="font-semibold">{eth ?? '…'} ETH</span>
					{#if usd}
						worth <span class="font-semibold">{usd}</span>
					{/if}.
				</p>
				<button type="button" class="btn shrink-0 preset-tonal btn-sm" disabled={claimingCauseId === cause.id} onclick={() => claim(cause)}>
					{claimingCauseId === cause.id ? 'Claiming…' : 'Claim now'}
				</button>
			</div>
		{/each}
	</div>
{/if}

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
