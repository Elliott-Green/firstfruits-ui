<script lang="ts">
	import { fetchRethApyHistory, type ApyPoint } from '$lib/rocketpool';

	const DAYS = 30;

	let history = $state<ApyPoint[]>([]);
	let loading = $state(true);
	let error = $state<string | undefined>(undefined);

	const recent = $derived(history.slice(-DAYS));
	const current = $derived(recent.at(-1)?.apy);
	const changeVsStart = $derived(
		recent.length > 1 && recent[0].apy > 0 ? ((recent.at(-1)!.apy - recent[0].apy) / recent[0].apy) * 100 : undefined
	);

	// A tiny inline sparkline — no charting library, just a normalized polyline.
	const sparklinePoints = $derived.by(() => {
		if (recent.length < 2) return '';
		const values = recent.map((p) => p.apy);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const width = 100;
		const height = 32;
		return values
			.map((v, i) => {
				const x = (i / (values.length - 1)) * width;
				const y = height - ((v - min) / range) * height;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	async function load() {
		loading = true;
		error = undefined;
		try {
			history = await fetchRethApyHistory();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load APY.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});
</script>

<div class="card p-6">
	<div class="flex items-center justify-between">
		<p class="text-sm opacity-60">Rocket Pool staking APY</p>
		{#if changeVsStart !== undefined}
			<span class="text-xs" class:text-green-600={changeVsStart >= 0} class:text-red-500={changeVsStart < 0}>
				{changeVsStart >= 0 ? '+' : ''}{changeVsStart.toFixed(1)}% ({DAYS}D)
			</span>
		{/if}
	</div>

	<div class="mt-1 flex items-end justify-between gap-4">
		<p class="text-2xl font-semibold">
			{#if loading}
				…
			{:else if error || current === undefined}
				—
			{:else}
				{current.toFixed(2)}%
			{/if}
		</p>

		{#if sparklinePoints}
			<svg viewBox="0 0 100 32" preserveAspectRatio="none" class="h-8 w-24 text-primary-500">
				<polyline points={sparklinePoints} fill="none" stroke="currentColor" stroke-width="2" />
			</svg>
		{/if}
	</div>

	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
</div>
