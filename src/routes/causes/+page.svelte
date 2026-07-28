<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
	import { fetchRethExchangeRate } from '$lib/contracts/reth';
	import { fetchLatestCauses, fetchCauseSupporterCounts } from '$lib/subgraph';
	import { fetchUsdPrices, convertRethToUsd, formatUsd, type UsdPrices } from '$lib/prices';
	import { readCache, writeCache, cacheWrittenAt } from '$lib/localCache';
	import { isCauseCurated } from '$lib/curatedCauses';
	import AddressLink from '$lib/components/AddressLink.svelte';

	type CauseRow = {
		id: string;
		name: string;
		owner: string;
		recipient: string;
		active: boolean;
		curated: boolean;
		totalHarvestedReth: bigint;
		claimableReth: bigint;
		supporterCount: number | undefined;
		createdTimestamp: number | undefined;
	};

	type SortKey = 'id' | 'name' | 'status' | 'supporters' | 'raised' | 'claimable' | 'created';

	const CACHE_KEY = 'firstfruits:causes-list:v1';
	// One on-chain call per cause (plus two subgraph queries) — fine at a
	// handful of causes, but the whole point of the search-to-add pattern
	// elsewhere in this app is that the catalog won't stay small forever, so
	// this gets the same localStorage cache the patron leaderboard has.
	const CACHE_TTL_MS = 10 * 60 * 1000;

	let causes = $state<CauseRow[]>([]);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);
	let usdPrices = $state<UsdPrices>({ ethUsd: undefined });
	// rETH → ETH redemption rate, for pricing rETH amounts in USD (see
	// convertRethToUsd's doc comment for why this isn't just a quoted rETH price).
	let exchangeRate = $state<bigint | undefined>(undefined);
	let cachedAt = $state<number | undefined>(undefined);
	// Keyed by lowercased address. `undefined` = not looked up yet, `null` = looked
	// up but no ENS name registered — the two are distinguished so the table can
	// keep showing the truncated address instead of flashing a "loading" state.
	let ensNames = $state<Map<string, string | null>>(new Map());

	async function resolveEnsNames(addresses: string[]) {
		const provider = getActiveProvider();
		const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
		const resolved = await Promise.all(
			unique.map(async (address) => [address, await provider.lookupAddress(address).catch(() => null)] as const)
		);
		ensNames = new Map([...ensNames, ...resolved]);
	}

	let sortKey = $state<SortKey>('raised');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			// Numbers/status/dates read better desc by default; name reads better asc.
			sortDir = key === 'name' ? 'asc' : 'desc';
		}
	}

	function cmpBigint(a: bigint, b: bigint): number {
		return a < b ? -1 : a > b ? 1 : 0;
	}

	const sortedCauses = $derived.by(() => {
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...causes].sort((a, b) => {
			switch (sortKey) {
				case 'id':
					return (Number(a.id) - Number(b.id)) * dir;
				case 'name':
					return a.name.localeCompare(b.name) * dir;
				case 'status':
					return (Number(a.active) - Number(b.active)) * dir;
				case 'supporters':
					return ((a.supporterCount ?? -1) - (b.supporterCount ?? -1)) * dir;
				case 'raised':
					return cmpBigint(a.totalHarvestedReth, b.totalHarvestedReth) * dir;
				case 'claimable':
					return cmpBigint(a.claimableReth, b.claimableReth) * dir;
				case 'created':
					return ((a.createdTimestamp ?? -1) - (b.createdTimestamp ?? -1)) * dir;
			}
		});
	});

	function formatReth(wei: bigint): string {
		return Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 4 });
	}

	function rethUsd(wei: bigint): string | undefined {
		if (usdPrices.ethUsd === undefined || exchangeRate === undefined) return undefined;
		return formatUsd(convertRethToUsd(wei, exchangeRate, usdPrices.ethUsd));
	}

	function relativeTime(timestamp: number | undefined): string {
		if (timestamp === undefined) return '—';
		const seconds = Date.now() / 1000 - timestamp;
		if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
		return new Date(timestamp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function loadPrices() {
		fetchUsdPrices()
			.then((p) => (usdPrices = p))
			.catch(() => {});
		fetchRethExchangeRate()
			.then((r) => (exchangeRate = r))
			.catch(() => {});
	}

	async function loadCauses(forceRefresh = false) {
		error = undefined;

		if (!forceRefresh) {
			const cached = readCache<CauseRow[]>(CACHE_KEY, CACHE_TTL_MS);
			if (cached) {
				causes = cached;
				cachedAt = cacheWrittenAt(CACHE_KEY);
				loadPrices();
				return;
			}
		}

		loading = true;
		try {
			if (!FIRSTFRUITS_ADDRESS) return;

			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const nextCauseId: bigint = await vault.nextCauseId();
			const ids = Array.from({ length: Number(nextCauseId) - 1 }, (_, i) => BigInt(i + 1));

			const [onChain, createdByCauseId, supportersByCauseId] = await Promise.all([
				Promise.all(
					ids.map(async (id) => {
						const [owner, , recipient, active, name, claimableReth, totalHarvestedReth] = await vault.causes(id);
						return { id: id.toString(), owner, recipient, active, name, claimableReth, totalHarvestedReth };
					})
				),
				// Best-effort: these come from the subgraph, not the contract. If it's
				// not configured (or the request fails), just show "—" for these
				// columns rather than breaking the whole page over decorative stats.
				fetchLatestCauses(200)
					.then((list) => new Map(list.map((c) => [c.causeId, Number(c.blockTimestamp)])))
					.catch(() => new Map<string, number>()),
				fetchCauseSupporterCounts().catch(() => new Map<string, number>())
			]);

			const rows = onChain.map((c) => ({
				...c,
				curated: isCauseCurated(c.id),
				createdTimestamp: createdByCauseId.get(c.id),
				supporterCount: supportersByCauseId.get(c.id)
			}));

			causes = rows;
			writeCache(CACHE_KEY, rows);
			cachedAt = Date.now();
			loadPrices();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load causes.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadCauses();
	});

	// Separate effect (rather than calling this from inside loadCauses) so it
	// has its own explicit reactive dependency on `causes` and `ensNames`, with
	// a convergence guard — only resolves addresses not already in the map, so
	// the re-run triggered by its own `ensNames` write finds nothing left to do
	// and stops, instead of looping.
	$effect(() => {
		const addresses = causes.flatMap((c) => [c.owner, c.recipient]);
		const unresolved = addresses.filter((a) => !ensNames.has(a.toLowerCase()));
		if (unresolved.length > 0) {
			resolveEnsNames(unresolved).catch(() => {});
		}
	});
</script>

<div class="px-4 py-8 lg:px-18">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<h1 class="text-3xl font-bold">Causes</h1>
		<div class="flex items-center gap-3">
			{#if cachedAt}
				<span class="text-xs opacity-60">Updated {relativeTime(cachedAt / 1000)}</span>
			{/if}
			<button type="button" class="btn btn-sm preset-tonal" onclick={() => loadCauses(true)} disabled={loading}>
				{loading ? 'Refreshing…' : 'Refresh'}
			</button>
			<a href="/causes/create" class="btn preset-filled-primary-500">Create a cause</a>
		</div>
	</div>

	{#if !FIRSTFRUITS_ADDRESS}
		<div class="card p-10 text-center opacity-75">
			The vault hasn't been deployed yet — set <code>VITE_FIRSTFRUITS_ADDRESS</code> once it is.
		</div>
	{:else if loading && causes.length === 0}
		<p class="opacity-60">Loading causes…</p>
	{:else if error}
		<p class="text-red-500">{error}</p>
	{:else if causes.length === 0}
		<p class="opacity-60">No causes have been created yet.</p>
	{:else}
		<div class="overflow-x-auto card border border-surface-200-800 bg-surface-50-950">
			<table class="w-full min-w-[980px] text-sm">
				<thead>
					<tr class="border-b border-surface-200-800 text-left text-xs opacity-60">
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('id')}>
								# {sortKey === 'id' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('name')}>
								Name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('status')}>
								Status {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button
								type="button"
								class="flex items-center gap-1 hover:text-primary-500"
								onclick={() => toggleSort('supporters')}
								title="Patrons who've ever had yield routed to this cause"
							>
								Supporters {sortKey === 'supporters' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('raised')}>
								Total Raised {sortKey === 'raised' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('claimable')}>
								Claimable {sortKey === 'claimable' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
						<th class="px-4 py-3 font-medium">Owner</th>
						<th class="px-4 py-3 font-medium">Recipient</th>
						<th class="px-4 py-3 font-medium">
							<button type="button" class="flex items-center gap-1 hover:text-primary-500" onclick={() => toggleSort('created')}>
								Created {sortKey === 'created' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedCauses as cause (cause.id)}
						{@const usdRaised = rethUsd(cause.totalHarvestedReth)}
						{@const usdClaimable = rethUsd(cause.claimableReth)}
						<tr class="border-b border-surface-200-800 last:border-0 hover:bg-surface-100-900/50">
							<td class="px-4 py-3 opacity-60">{cause.id}</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1.5 font-medium">
									{#if cause.curated}
										<span class="text-amber-500" title="Curated cause">⭐</span>
									{/if}
									{cause.name}
								</div>
							</td>
							<td class="px-4 py-3">
								{#if cause.active}
									<span class="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
										Active
									</span>
								{:else}
									<span class="rounded-full bg-surface-200-800 px-2 py-0.5 text-xs font-medium opacity-60">Inactive</span>
								{/if}
							</td>
							<td class="px-4 py-3">{cause.supporterCount ?? '—'}</td>
							<td class="px-4 py-3">
								<span class="font-medium">{formatReth(cause.totalHarvestedReth)} rETH</span>
								{#if usdRaised}
									<span class="text-xs opacity-50">({usdRaised})</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="font-medium">{formatReth(cause.claimableReth)} rETH</span>
								{#if usdClaimable}
									<span class="text-xs opacity-50">({usdClaimable})</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<AddressLink address={cause.owner} ensName={ensNames.get(cause.owner.toLowerCase())} />
							</td>
							<td class="px-4 py-3">
								<AddressLink address={cause.recipient} ensName={ensNames.get(cause.recipient.toLowerCase())} />
							</td>
							<td class="px-4 py-3 whitespace-nowrap opacity-60">{relativeTime(cause.createdTimestamp)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<p class="mt-4 text-xs opacity-50">
		Cause creation is permissionless — anyone can create one. This list is cached locally for
		{CACHE_TTL_MS / 60000} minutes — use Refresh for the latest.
	</p>
</div>
