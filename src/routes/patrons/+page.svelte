<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { getVaultWithSigner } from '$lib/contracts/signer';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
	import { fetchPatronLeaderboard, type PatronLeaderboardRow } from '$lib/subgraph';
	import { fetchUsdPrices, convertRethToUsd, formatUsd, type UsdPrices } from '$lib/prices';
	import { fetchRethExchangeRate } from '$lib/contracts/reth';
	import { readCache, writeCache, cacheWrittenAt } from '$lib/localCache';
	import AddressLink from '$lib/components/AddressLink.svelte';
	import { getContractErrorMessage } from '$lib/errors';

	const SUBGRAPH_CONFIGURED = Boolean(import.meta.env.VITE_SUBGRAPH_URL);

	const CACHE_KEY = 'firstfruits:patron-leaderboard:v1';
	// The underlying query pulls full Deposited/YieldAllocated event lists and
	// aggregates client-side — expensive enough that we don't want to re-run it
	// on every page visit, hence the localStorage cache.
	const CACHE_TTL_MS = 10 * 60 * 1000;

	type SortKey = 'deposited' | 'donated' | 'claimable' | 'firstDeposit';

	let patrons = $state<PatronLeaderboardRow[]>([]);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);
	let usdPrices = $state<UsdPrices>({ ethUsd: undefined });
	// rETH → ETH redemption rate, for pricing rETH amounts in USD (see
	// convertRethToUsd's doc comment for why this isn't just a quoted rETH price).
	let exchangeRate = $state<bigint | undefined>(undefined);
	let cachedAt = $state<number | undefined>(undefined);
	// Keyed by lowercased address. `undefined` = not looked up yet, `null` = looked
	// up but no ENS name registered — distinguished so the table keeps showing
	// the truncated address instead of flashing a "loading" state.
	let ensNames = $state<Map<string, string | null>>(new Map());

	// Live on-chain claimable yield per patron (lowercased address -> rETH
	// wei). Unlike the totals above, this can't come from the subgraph and
	// isn't cached — it changes continuously as rETH's exchange rate moves,
	// and a stale number here would be actively misleading right where people
	// click "Harvest".
	let pendingYields = $state<Map<string, bigint>>(new Map());
	let selected = $state<Set<string>>(new Set());
	let harvestingAddresses = $state<Set<string>>(new Set());
	let harvestingBulk = $state(false);
	// Shared modal for harvest errors, matching the dashboard's pattern — not
	// inline text, since these are transient action failures (retry in place),
	// not "the page has no data" states.
	let errorModalMessage = $state<string | undefined>(undefined);

	let sortKey = $state<SortKey>('donated');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'desc';
		}
	}

	function cmpBigint(a: bigint, b: bigint): number {
		return a < b ? -1 : a > b ? 1 : 0;
	}

	const sortedPatrons = $derived.by(() => {
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...patrons].sort((a, b) => {
			switch (sortKey) {
				case 'deposited':
					return cmpBigint(a.totalDepositedEther, b.totalDepositedEther) * dir;
				case 'donated':
					return cmpBigint(a.totalDonatedReth, b.totalDonatedReth) * dir;
				case 'claimable':
					return (
						cmpBigint(pendingYields.get(a.address.toLowerCase()) ?? 0n, pendingYields.get(b.address.toLowerCase()) ?? 0n) * dir
					);
				case 'firstDeposit':
					return (a.firstDepositTimestamp - b.firstDepositTimestamp) * dir;
			}
		});
	});

	const totalDeposited = $derived(patrons.reduce((sum, p) => sum + p.totalDepositedEther, 0n));
	const totalDonated = $derived(patrons.reduce((sum, p) => sum + p.totalDonatedReth, 0n));

	// Only patrons with actually-claimable yield are selectable — no point
	// selecting (or paying gas to harvest) a zero balance.
	const selectableAddresses = $derived(
		patrons.map((p) => p.address.toLowerCase()).filter((a) => (pendingYields.get(a) ?? 0n) > 0n)
	);
	const allSelected = $derived(selectableAddresses.length > 0 && selectableAddresses.every((a) => selected.has(a)));

	function toggleSelectAll() {
		selected = allSelected ? new Set() : new Set(selectableAddresses);
	}

	function toggleSelected(address: string) {
		const key = address.toLowerCase();
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}

	async function resolveEnsNames(addresses: string[]) {
		const provider = getActiveProvider();
		const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
		const resolved = await Promise.all(
			unique.map(async (address) => [address, await provider.lookupAddress(address).catch(() => null)] as const)
		);
		ensNames = new Map([...ensNames, ...resolved]);
	}

	// Best-effort per-patron on-chain reads, run once patrons are known.
	// `harvest`/`harvestMany` are permissionless (anyone may harvest for
	// anyone), so this is purely a read to decide what's worth harvesting.
	async function loadPendingYields(addresses: string[]) {
		if (!FIRSTFRUITS_ADDRESS || addresses.length === 0) return;
		const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
		const entries = await Promise.all(
			addresses.map(async (address): Promise<[string, bigint] | undefined> => {
				try {
					const [rethAmount] = await vault.pendingYield(address);
					return [address.toLowerCase(), rethAmount as bigint];
				} catch {
					return undefined;
				}
			})
		);
		const next = new Map(pendingYields);
		for (const entry of entries) {
			if (entry) next.set(entry[0], entry[1]);
		}
		pendingYields = next;
	}

	function formatAmount(wei: bigint): string {
		// 6dp, not 4 — at 4dp small-but-distinct rETH amounts (e.g. lifetime
		// donated vs. currently-pending yield for a patron who's barely
		// harvested) round to the same displayed string and look like a bug.
		return Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 6 });
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

	function relativeTime(timestamp: number): string {
		const seconds = Date.now() / 1000 - timestamp;
		if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
		return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	async function loadPatrons(forceRefresh = false) {
		error = undefined;

		if (!forceRefresh) {
			const cached = readCache<PatronLeaderboardRow[]>(CACHE_KEY, CACHE_TTL_MS);
			if (cached) {
				patrons = cached;
				cachedAt = cacheWrittenAt(CACHE_KEY);
				loadPrices();
				return;
			}
		}

		loading = true;
		try {
			const rows = await fetchPatronLeaderboard();
			patrons = rows;
			writeCache(CACHE_KEY, rows);
			cachedAt = Date.now();
			loadPrices();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load patrons.';
		} finally {
			loading = false;
		}
	}

	async function harvestOne(address: string) {
		const key = address.toLowerCase();
		harvestingAddresses = new Set([...harvestingAddresses, key]);
		try {
			const vault = await getVaultWithSigner();
			const tx = await vault.harvest(address);
			await tx.wait();
			pendingYields = new Map([...pendingYields, [key, 0n]]);
			if (selected.has(key)) {
				const next = new Set(selected);
				next.delete(key);
				selected = next;
			}
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Harvest failed.');
		} finally {
			const next = new Set(harvestingAddresses);
			next.delete(key);
			harvestingAddresses = next;
		}
	}

	async function harvestSelected() {
		const addresses = [...selected];
		if (addresses.length === 0) return;
		harvestingBulk = true;
		try {
			const vault = await getVaultWithSigner();
			const tx = await vault.harvestMany(addresses);
			await tx.wait();
			const next = new Map(pendingYields);
			for (const a of addresses) next.set(a, 0n);
			pendingYields = next;
			selected = new Set();
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Bulk harvest failed.');
		} finally {
			harvestingBulk = false;
		}
	}

	$effect(() => {
		loadPatrons();
	});

	// Separate effect with its own convergence guard (only resolves addresses
	// not already in the map) so the re-run triggered by its own `ensNames`
	// write finds nothing left to do and stops, instead of looping.
	$effect(() => {
		const unresolved = patrons.map((p) => p.address).filter((a) => !ensNames.has(a.toLowerCase()));
		if (unresolved.length > 0) {
			resolveEnsNames(unresolved).catch(() => {});
		}
	});

	// Same convergence-guard shape as the ENS effect above.
	$effect(() => {
		const unresolved = patrons.map((p) => p.address).filter((a) => !pendingYields.has(a.toLowerCase()));
		if (unresolved.length > 0) {
			loadPendingYields(unresolved).catch(() => {});
		}
	});
</script>

<div class="px-4 py-8 lg:px-18">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold">Patrons</h1>
			<p class="mt-1 text-sm opacity-60">Everyone who's ever deposited, ranked by lifetime yield donated to causes.</p>
		</div>
		<div class="flex items-center gap-2 text-xs opacity-60">
			{#if cachedAt}
				<span>Updated {relativeTime(cachedAt / 1000)}</span>
			{/if}
			<button type="button" class="btn btn-sm preset-tonal" onclick={() => loadPatrons(true)} disabled={loading}>
				{loading ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if !SUBGRAPH_CONFIGURED}
		<div class="card p-10 text-center opacity-75">
			The patron leaderboard is powered by the subgraph — set <code>VITE_SUBGRAPH_URL</code> to enable it.
		</div>
	{:else if loading && patrons.length === 0}
		<p class="opacity-60">Loading patrons…</p>
	{:else if error}
		<p class="text-red-500">{error}</p>
	{:else if patrons.length === 0}
		<p class="opacity-60">No one has deposited yet.</p>
	{:else}
		<p class="mb-4 text-sm opacity-60">
			{patrons.length} patron{patrons.length === 1 ? '' : 's'} · {formatAmount(totalDeposited)} ETH deposited in total · {formatAmount(
				totalDonated
			)} rETH donated to causes
		</p>

		{#if selected.size > 0}
			<div class="mb-3 flex items-center justify-between rounded-lg bg-primary-500/10 px-4 py-2 text-sm">
				<span>{selected.size} selected</span>
				<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={harvestSelected} disabled={harvestingBulk}>
					{harvestingBulk ? 'Harvesting…' : `Harvest Selected (${selected.size})`}
				</button>
			</div>
		{/if}

		<div class="overflow-x-auto card border border-surface-200-800 bg-surface-50-950">
			<table class="w-full min-w-[980px] text-sm">
				<thead>
					<tr class="border-b border-surface-200-800 text-left text-xs opacity-60">
						<th class="px-4 py-3 font-medium">
							<input
								type="checkbox"
								checked={allSelected}
								disabled={selectableAddresses.length === 0}
								onchange={toggleSelectAll}
								aria-label="Select all patrons with claimable yield"
							/>
						</th>
						<th class="px-4 py-3 font-medium">#</th>
						<th class="px-4 py-3 font-medium">Patron</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('deposited')}>
								Total Deposited {sortKey === 'deposited' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button
								type="button"
								class="flex items-center gap-1 hover:text-primary-500"
								onclick={() => toggleSort('donated')}
								title="Lifetime yield this patron has routed to causes"
							>
								Donated to Causes {sortKey === 'donated' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button
								type="button"
								class="flex items-center gap-1 hover:text-primary-500"
								onclick={() => toggleSort('claimable')}
								title="Unharvested yield right now"
							>
								Claimable {sortKey === 'claimable' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('firstDeposit')}>
								First Deposit {sortKey === 'firstDeposit' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium"></th>
					</tr>
				</thead>
				<tbody>
					{#each sortedPatrons as patron, i (patron.address)}
						{@const key = patron.address.toLowerCase()}
						{@const claimable = pendingYields.get(key)}
						{@const usdDeposited = ethUsd(patron.totalDepositedEther)}
						{@const usdDonated = rethUsd(patron.totalDonatedReth)}
						{@const usdClaimable = claimable !== undefined ? rethUsd(claimable) : undefined}
						<tr class="border-b border-surface-200-800 last:border-0 hover:bg-surface-100-900/50">
							<td class="px-4 py-3">
								<input
									type="checkbox"
									checked={selected.has(key)}
									disabled={!claimable}
									onchange={() => toggleSelected(patron.address)}
									aria-label="Select {patron.address}"
								/>
							</td>
							<td class="px-4 py-3 opacity-60">
								{#if sortKey === 'donated' && i < 3}
									{['🥇', '🥈', '🥉'][i]}
								{:else}
									{i + 1}
								{/if}
							</td>
							<td class="px-4 py-3">
								<AddressLink address={patron.address} ensName={ensNames.get(key)} />
							</td>
							<td class="px-4 py-3">
								<span class="font-medium">{formatAmount(patron.totalDepositedEther)} ETH</span>
								{#if usdDeposited}
									<span class="text-xs opacity-50">({usdDeposited})</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="font-medium text-green-600 dark:text-green-400">{formatAmount(patron.totalDonatedReth)} rETH</span>
								{#if usdDonated}
									<span class="text-xs opacity-50">({usdDonated})</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								{#if claimable === undefined}
									<span class="opacity-40">…</span>
								{:else if claimable === 0n}
									<span class="opacity-40">—</span>
								{:else}
									<span class="font-medium">{formatAmount(claimable)} rETH</span>
									{#if usdClaimable}
										<span class="text-xs opacity-50">({usdClaimable})</span>
									{/if}
								{/if}
							</td>
							<td class="px-4 py-3 whitespace-nowrap opacity-60">{relativeTime(patron.firstDepositTimestamp)}</td>
							<td class="px-4 py-3">
								<button
									type="button"
									class="btn btn-sm preset-tonal"
									disabled={!claimable || harvestingAddresses.has(key)}
									onclick={() => harvestOne(patron.address)}
								>
									{harvestingAddresses.has(key) ? 'Harvesting…' : 'Harvest'}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<p class="mt-4 text-xs opacity-50">
		Deposited/donated totals come from the subgraph and are cached locally for {CACHE_TTL_MS / 60000} minutes — use Refresh
		for the latest. Claimable yield is read live on-chain every visit, since it changes continuously. Harvesting is
		permissionless: anyone can harvest for anyone, and yield always routes to that patron's own chosen causes.
	</p>
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
					<Dialog.CloseTrigger class="btn preset-filled-primary-500">Close</Dialog.CloseTrigger>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
