<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
	import { fetchRethApyHistory } from '$lib/rocketpool';
	import { fetchDailySnapshots, type DailySnapshot } from '$lib/subgraph';

	const APY_DAYS = 30;
	const TVL_DAYS = 30;
	const CHART_WIDTH = 600;
	const CHART_HEIGHT = 120;
	const APY_CHART_HEIGHT = 64;

	function formatAmount(wei: bigint): string {
		return Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 4 });
	}

	let totalValueLockedEther = $state<bigint | undefined>(undefined);
	let causeCount = $state<number | undefined>(undefined);
	let totalYieldDonatedReth = $state<bigint | undefined>(undefined);
	let loading = $state(true);

	let apyHistory = $state<{ timestamp: string; apy: number }[]>([]);
	const recentApy = $derived(apyHistory.slice(-APY_DAYS));
	const currentApy = $derived(recentApy.at(-1)?.apy);

	// A hand-rolled sparkline (no charting library) — same approach as the TVL
	// chart above, just without the area fill.
	const apyChart = $derived.by(() => {
		if (recentApy.length < 2) return undefined;
		const values = recentApy.map((p) => p.apy);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const linePoints = values
			.map((v, i) => {
				const x = (i / (values.length - 1)) * CHART_WIDTH;
				const y = APY_CHART_HEIGHT - ((v - min) / range) * APY_CHART_HEIGHT;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
		return { line: linePoints };
	});

	let tvlSnapshots = $state<DailySnapshot[]>([]);
	const recentTvl = $derived(tvlSnapshots.slice(-TVL_DAYS));

	const tvlChangePercent = $derived.by(() => {
		if (recentTvl.length < 2) return undefined;
		const first = Number(formatEther(BigInt(recentTvl[0].totalPrincipalEther)));
		const last = Number(formatEther(BigInt(recentTvl.at(-1)!.totalPrincipalEther)));
		if (first === 0) return undefined;
		return ((last - first) / first) * 100;
	});

	// Same hand-rolled area-chart approach as the mock version, now fed by
	// real subgraph data instead of made-up numbers.
	const tvlChart = $derived.by(() => {
		if (recentTvl.length < 2) return undefined;
		const values = recentTvl.map((s) => Number(formatEther(BigInt(s.totalPrincipalEther))));
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const linePoints = values
			.map((v, i) => {
				const x = (i / (values.length - 1)) * CHART_WIDTH;
				const y = CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
		return {
			line: linePoints,
			area: `M0,${CHART_HEIGHT} L${linePoints} L${CHART_WIDTH},${CHART_HEIGHT} Z`
		};
	});

	async function loadVaultStats() {
		if (!FIRSTFRUITS_ADDRESS) return;
		loading = true;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const [principalEther, nextCauseId] = await Promise.all([vault.totalPrincipalEther(), vault.nextCauseId()]);
			totalValueLockedEther = principalEther;
			causeCount = Number(nextCauseId) - 1;

			const ids = Array.from({ length: causeCount }, (_, i) => BigInt(i + 1));
			const causes = await Promise.all(ids.map((id) => vault.causes(id)));
			totalYieldDonatedReth = causes.reduce((sum: bigint, c: { totalHarvestedReth: bigint }) => sum + c.totalHarvestedReth, 0n);
		} catch {
			// Decorative on the homepage; fail quietly and show placeholders.
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadVaultStats();
		fetchRethApyHistory()
			.then((h) => (apyHistory = h))
			.catch(() => {});
		fetchDailySnapshots(TVL_DAYS)
			.then((s) => (tvlSnapshots = s))
			.catch(() => {
				// Subgraph may not be configured/reachable yet — the chart and
				// %change badge just don't render in that case.
			});
	});
</script>

<div class="card rounded-xl border border-gray-500 p-6 shadow-xl">
	<div class="flex items-center justify-between border-b border-surface-200 pb-4 dark:border-surface-800">
		<h2 class="text-lg font-semibold">Vault Overview</h2>
	</div>

	<div class="pt-4">
		<p class="text-sm opacity-60">Total Value Locked</p>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-3xl font-semibold">
				{totalValueLockedEther !== undefined ? formatAmount(totalValueLockedEther) : loading ? '…' : '—'}
				<span class="text-xl">Ξ</span>
			</p>
			{#if tvlChangePercent !== undefined}
				<span class="text-xs font-medium" class:text-green-600={tvlChangePercent >= 0} class:text-red-500={tvlChangePercent < 0}>
					{tvlChangePercent >= 0 ? '+' : ''}{tvlChangePercent.toFixed(2)}% ({TVL_DAYS}D)
				</span>
			{/if}
		</div>
	</div>

	{#if tvlChart}
		<div class="mt-4">
			<svg viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}" preserveAspectRatio="none" class="h-24 w-full text-primary-500">
				<defs>
					<linearGradient id="vault-tvl-gradient" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="currentColor" stop-opacity="0.25" />
						<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
					</linearGradient>
				</defs>
				<path d={tvlChart.area} fill="url(#vault-tvl-gradient)" />
				<polyline points={tvlChart.line} fill="none" stroke="currentColor" stroke-width="2" />
			</svg>
		</div>
	{/if}

	<div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
		<div class="rounded-lg bg-surface-100 p-3 dark:bg-surface-800">
			<p class="text-xs opacity-60">Supported Causes</p>
			<p class="text-lg font-semibold">{causeCount ?? (loading ? '…' : '—')}</p>
		</div>
		<div class="rounded-lg bg-surface-100 p-3 dark:bg-surface-800">
			<p class="text-xs opacity-60">Total Yield Donated</p>
			<p class="text-lg font-semibold">
				{totalYieldDonatedReth !== undefined ? formatAmount(totalYieldDonatedReth) : loading ? '…' : '—'} rETH
			</p>
		</div>
		<div class="rounded-lg bg-surface-100 p-3 dark:bg-surface-800">
			<p class="text-xs opacity-60">Rocket Pool APY</p>
			<p class="text-lg font-semibold">
				{currentApy !== undefined ? `${currentApy.toFixed(2)}%` : '…'}
			</p>
			{#if apyChart}
				<svg viewBox="0 0 {CHART_WIDTH} {APY_CHART_HEIGHT}" preserveAspectRatio="none" class="mt-1 h-8 w-full text-primary-500">
					<polyline points={apyChart.line} fill="none" stroke="currentColor" stroke-width="2" />
				</svg>
			{/if}
		</div>
	</div>

	<a href="/dashboard" class="mt-6 btn w-full justify-center preset-tonal">Manage Your Vault →</a>
</div>
