<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { account, openConnectModal } from '$lib/wallet.svelte';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi, BPS_DENOMINATOR } from '$lib/contracts/firstfruits';
	import { getVaultWithSigner } from '$lib/contracts/signer';
	import ApyCard from '$lib/components/ApyCard.svelte';

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

	let position = $state<Position | undefined>(undefined);
	let pendingYieldReth = $state<bigint | undefined>(undefined);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	let splits = $state<Split[]>([]);
	let splitsLoading = $state(false);
	let saving = $state(false);
	let saveError = $state<string | undefined>(undefined);
	let saveSuccess = $state(false);

	const totalBps = $derived(splits.reduce((sum, s) => sum + s.bps, 0));
	const bpsDenominator = Number(BPS_DENOMINATOR);

	async function loadPosition(patron: string) {
		if (!FIRSTFRUITS_ADDRESS) return;
		loading = true;
		error = undefined;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const [rethBalance, principalEther, bankedReth] = await vault.patrons(patron);
			position = { rethBalance, principalEther, bankedReth };

			const [rethAmount] = await vault.pendingYield(patron);
			pendingYieldReth = rethAmount;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load position.';
		} finally {
			loading = false;
		}
	}

	async function loadSplits(patron: string) {
		if (!FIRSTFRUITS_ADDRESS) return;
		splitsLoading = true;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const nextCauseId: bigint = await vault.nextCauseId();
			const ids = Array.from({ length: Number(nextCauseId) - 1 }, (_, i) => BigInt(i + 1));

			const [causeList, currentAllocations] = await Promise.all([
				Promise.all(
					ids.map(async (id) => {
						const [, , , active, name] = await vault.causes(id);
						return { id, name, active } satisfies CauseOption;
					})
				),
				vault.allocationsOf(patron) as Promise<{ causeId: bigint; bps: bigint }[]>
			]);

			const currentByCauseId = new Map(currentAllocations.map((a) => [a.causeId, Number(a.bps)]));
			splits = causeList
				.filter((c) => c.active || currentByCauseId.has(c.id))
				.map((c) => ({ causeId: c.id, name: c.name, bps: currentByCauseId.get(c.id) ?? 0 }));
		} catch {
			// Leave splits empty; the editor will just show nothing to allocate.
		} finally {
			splitsLoading = false;
		}
	}

	async function saveSplits() {
		saving = true;
		saveError = undefined;
		saveSuccess = false;
		try {
			const vault = await getVaultWithSigner();
			const allocations = splits
				.filter((s) => s.bps > 0)
				.sort((a, b) => (a.causeId < b.causeId ? -1 : 1))
				.map((s) => ({ causeId: s.causeId, bps: s.bps }));
			const tx = await vault.designate(allocations);
			await tx.wait();
			saveSuccess = true;
			if (account.address) await loadPosition(account.address);
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save splits.';
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (account.address) {
			loadPosition(account.address);
			loadSplits(account.address);
		} else {
			position = undefined;
			pendingYieldReth = undefined;
			splits = [];
		}
	});
</script>

<div class="px-4 py-8 lg:px-18">
	<h1 class="mb-6 text-3xl font-bold">Your Vault</h1>

	{#if !account.isConnected}
		<div class="flex flex-col items-center gap-4 card p-10 text-center">
			<p class="opacity-75">Connect your wallet to view your position and deposit.</p>
			<button type="button" class="btn preset-filled-primary-500" onclick={openConnectModal}> Connect wallet </button>
		</div>
	{:else if !FIRSTFRUITS_ADDRESS}
		<div class="card p-10 text-center opacity-75">
			The vault hasn't been deployed yet — set <code>VITE_FIRSTFRUITS_ADDRESS</code> once it is.
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="card p-6">
				<p class="text-sm opacity-60">Withdrawable principal</p>
				<p class="text-2xl font-semibold">
					{position ? formatEther(position.principalEther) : loading ? '…' : '0'} ETH
				</p>
			</div>
			<div class="card p-6">
				<p class="text-sm opacity-60">rETH held</p>
				<p class="text-2xl font-semibold">
					{position ? formatEther(position.rethBalance) : loading ? '…' : '0'} rETH
				</p>
			</div>
			<div class="card p-6">
				<p class="text-sm opacity-60">Pending yield (unharvested)</p>
				<p class="text-2xl font-semibold">
					{pendingYieldReth !== undefined ? formatEther(pendingYieldReth) : loading ? '…' : '0'} rETH
				</p>
			</div>
			<div class="card p-6">
				<p class="text-sm opacity-60">Banked (undesignated) yield</p>
				<p class="text-2xl font-semibold">
					{position ? formatEther(position.bankedReth) : loading ? '…' : '0'} rETH
				</p>
			</div>
			<div class="sm:col-span-2">
				<ApyCard />
			</div>
		</div>

		{#if error}
			<p class="mt-4 text-sm text-red-500">{error}</p>
		{/if}

		<div class="mt-8 grid gap-4 sm:grid-cols-3">
			<button type="button" class="btn preset-filled-primary-500" disabled>Deposit</button>
			<button type="button" class="btn preset-tonal" disabled>Withdraw</button>
			<button type="button" class="btn preset-tonal" disabled>Withdraw bank</button>
		</div>
		<p class="mt-2 text-xs opacity-50">Deposit / withdraw forms are next.</p>

		<!-- Cause allocation editor -->
		<div class="mt-8 card p-6">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold">Your Cause Allocations</h2>
				<p class="text-sm opacity-60">Total must be at most {bpsDenominator} bps</p>
			</div>

			{#if splitsLoading}
				<p class="mt-4 text-sm opacity-50">Loading causes…</p>
			{:else if splits.length === 0}
				<p class="mt-4 text-sm opacity-50">No active causes to allocate to yet.</p>
			{:else}
				<div class="mt-4 flex flex-col gap-4">
					{#each splits as split (split.causeId)}
						<div>
							<div class="flex items-center justify-between text-sm">
								<span class="font-medium">{split.name}</span>
								<span class="opacity-60">{split.bps} bps ({(split.bps / 100).toFixed(1)}%)</span>
							</div>
							<input type="range" min="0" max={bpsDenominator} step="100" bind:value={split.bps} class="w-full" />
						</div>
					{/each}
				</div>

				<div class="mt-4 flex items-center justify-between border-t pt-4 text-sm">
					<span>Total</span>
					<span class:text-red-500={totalBps > bpsDenominator}>
						{totalBps} / {bpsDenominator} bps
					</span>
				</div>

				{#if saveError}
					<p class="mt-2 text-sm text-red-500">{saveError}</p>
				{/if}
				{#if saveSuccess}
					<p class="mt-2 text-sm text-green-600">Splits saved.</p>
				{/if}

				<button
					type="button"
					class="mt-4 btn w-full justify-center preset-filled-primary-500"
					disabled={saving || totalBps > bpsDenominator}
					onclick={saveSplits}
				>
					{saving ? 'Saving…' : 'Save Splits'}
				</button>
			{/if}
		</div>
	{/if}
</div>
