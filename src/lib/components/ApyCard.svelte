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

<div class="card p-6 bg-surface-100-900">
	<p class="text-sm opacity-60">Rocket Pool staking APY</p>
	<p class="mt-1 text-2xl font-semibold">
		{#if loading}
			…
		{:else if error || current === undefined}
			—
		{:else}
			{current.toFixed(2)}%
		{/if}
	</p>
	{#if changeVsStart !== undefined}
		<p class="mt-1 text-xs opacity-50">
			<span class:text-green-600={changeVsStart >= 0} class:text-red-500={changeVsStart < 0}>
				{changeVsStart >= 0 ? '+' : ''}{changeVsStart.toFixed(1)}%
			</span>
			over {DAYS}D
		</p>
	{:else}
		<p class="mt-1 text-xs opacity-50">Current estimated APY</p>
	{/if}

	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
</div>
