<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';

	type Cause = {
		id: bigint;
		owner: string;
		recipient: string;
		active: boolean;
		name: string;
		claimableReth: bigint;
		totalHarvestedReth: bigint;
	};

	let causes = $state<Cause[]>([]);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	async function loadCauses() {
		if (!FIRSTFRUITS_ADDRESS) return;
		loading = true;
		error = undefined;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const nextCauseId: bigint = await vault.nextCauseId();

			const ids = Array.from({ length: Number(nextCauseId) - 1 }, (_, i) => BigInt(i + 1));
			const loaded = await Promise.all(
				ids.map(async (id) => {
					const [owner, pendingOwner, recipient, active, name, claimableReth, totalHarvestedReth] = await vault.causes(id);
					return { id, owner, recipient, active, name, claimableReth, totalHarvestedReth };
				})
			);
			causes = loaded;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load causes.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadCauses();
	});
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Causes</h1>
		<button type="button" class="btn preset-filled-primary-500" disabled>Create a cause</button>
	</div>

	{#if !FIRSTFRUITS_ADDRESS}
		<div class="card p-10 text-center opacity-75">
			The vault hasn't been deployed yet — set <code>VITE_FIRSTFRUITS_ADDRESS</code> once it is.
		</div>
	{:else if loading}
		<p class="opacity-60">Loading causes…</p>
	{:else if error}
		<p class="text-red-500">{error}</p>
	{:else if causes.length === 0}
		<p class="opacity-60">No causes have been created yet.</p>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each causes as cause (cause.id)}
				<div class="flex flex-col gap-2 card p-6">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">{cause.name}</h2>
						{#if !cause.active}
							<span class="text-xs opacity-50">Inactive</span>
						{/if}
					</div>
					<p class="text-xs opacity-50">
						Recipient: {cause.recipient.slice(0, 6)}…{cause.recipient.slice(-4)}
					</p>
					<p class="text-sm">
						Lifetime harvested: {formatEther(cause.totalHarvestedReth)} rETH
					</p>
					<p class="text-sm">Claimable now: {formatEther(cause.claimableReth)} rETH</p>
				</div>
			{/each}
		</div>
	{/if}

	<p class="mt-4 text-xs opacity-50">Cause creation is permissionless — the button above will open a create form next.</p>
</div>
