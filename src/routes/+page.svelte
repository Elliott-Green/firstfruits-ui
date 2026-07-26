<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import { openConnectModal } from '$lib/wallet.svelte';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { FIRSTFRUITS_ADDRESS, RETH_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
	import VaultOverviewPreview from '$lib/components/VaultOverviewPreview.svelte';
	import RocketPoolLogo from '$lib/assets/rp_logo.svg';

	type CausePreview = {
		id: bigint;
		recipient: string;
		active: boolean;
		name: string;
		totalHarvestedReth: bigint;
	};

	let previewCauses = $state<CausePreview[]>([]);
	let statsLoading = $state(false);

	const steps = [
		{ icon: '💠', title: 'Stake ETH', body: 'Deposit ETH into your Firstfruits vault.' },
		{
			icon: '🪙',
			title: 'Earn rETH',
			body: 'Your ETH is staked via Rocket Pool and becomes rETH.'
		},
		{
			icon: '📈',
			title: 'Growth (yield)',
			body: 'rETH appreciates over time, generating staking yield.'
		},
		{
			icon: '❤️',
			title: 'Give automatically',
			body: 'Yield is routed to your chosen causes, by your splits.'
		},
		{
			icon: '🛡️',
			title: 'Withdraw anytime',
			body: 'Your principal (in ETH terms) is always yours.'
		}
	];

	const transparency = [
		{
			label: 'Vault Contract',
			value: FIRSTFRUITS_ADDRESS,
			href: FIRSTFRUITS_ADDRESS ? `https://etherscan.io/address/${FIRSTFRUITS_ADDRESS}#code` : undefined
		},
		{
			label: 'rETH Token',
			value: RETH_ADDRESS,
			href: RETH_ADDRESS ? `https://etherscan.io/token/${RETH_ADDRESS}#code` : undefined
		}
	];

	async function loadStats() {
		if (!FIRSTFRUITS_ADDRESS) return;
		statsLoading = true;
		try {
			const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
			const nextCauseId: bigint = await vault.nextCauseId();

			const ids = Array.from({ length: Number(nextCauseId) - 1 }, (_, i) => BigInt(i + 1));
			const loaded = await Promise.all(
				ids.map(async (id) => {
					const [, , recipient, active, name, , totalHarvestedReth] = await vault.causes(id);
					return { id, recipient, active, name, totalHarvestedReth } satisfies CausePreview;
				})
			);
			previewCauses = loaded.slice(0, 4);
		} catch {
			// Homepage stats are decorative; fail quietly and show placeholders.
		} finally {
			statsLoading = false;
		}
	}

	$effect(() => {
		loadStats();
	});
</script>

<!-- Hero -->
<section class="border-b border-surface-200 bg-surface-50 px-18 py-20 dark:border-surface-800 dark:bg-surface-950">
	<div class="mx-auto grid items-center gap-20 lg:grid-cols-2">
		<div>
			<span class="mb-6 badge inline-flex items-center gap-3 preset-tonal px-4">
				<img src={RocketPoolLogo} alt="rocketpool logo" class="w-8" />
				<span class="text-lg">Built on Rocket Pool</span>
			</span>

			<h1 class="text-5xl leading-tight font-bold sm:text-6xl">
				Stake ETH.
				<br />
				<span class="text-primary-500">Give what grows.</span>
			</h1>

			<p class="mt-6 text-lg opacity-70">
				Firstfruits is a charitable-giving vault. Stake ETH, earn staking yield via rETH, and we route the growth to causes you care about.
				Your principal stays yours and is withdrawable anytime.
			</p>

			<div class="mt-8 flex flex-wrap items-center gap-4">
				<button type="button" class="btn preset-filled-primary-500 font-semibold" onclick={openConnectModal}> Stake ETH Now → </button>
				<a href="/causes" class="btn preset-tonal">Explore Causes</a>
			</div>

			<div class="mt-10 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
				<div class="flex items-start gap-3">
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10"> 🛡️ </span>
					<div>
						<p class="font-semibold">Principal always yours</p>
						<p class="opacity-60">Withdraw your ETH anytime.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-500/10"> 🪙 </span>
					<div>
						<p class="font-semibold">Powered by rETH</p>
						<p class="opacity-60">Secure, decentralized liquid staking.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10"> ❤️ </span>
					<div>
						<p class="font-semibold">Give automatically</p>
						<p class="opacity-60">Yield routed based on your splits.</p>
					</div>
				</div>
			</div>
		</div>

		<VaultOverviewPreview />
	</div>
</section>

<!-- How it works -->
<section id="how-it-works" class="scroll-mt-20 px-4 py-20">
	<div class="mx-auto max-w-6xl text-center">
		<p class="text-sm font-semibold tracking-wide text-primary-500 uppercase">How it works</p>
		<h2 class="mt-2 text-3xl font-bold sm:text-4xl">Simple. Transparent. Impactful.</h2>

		<div class="mt-12 flex flex-col items-center gap-6 lg:flex-row lg:justify-center">
			{#each steps as step, i (step.title)}
				<div class="flex flex-col items-center gap-3 text-center lg:w-40">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10 text-2xl">
						{step.icon}
					</div>
					<h3 class="text-sm font-semibold">{step.title}</h3>
					<p class="text-xs opacity-60">{step.body}</p>
				</div>
				{#if i < steps.length - 1}
					<span class="hidden text-xl text-primary-500/40 lg:block">→</span>
				{/if}
			{/each}
		</div>
	</div>
</section>

<!-- Explore causes preview -->
<section class="border-y border-surface-200 bg-surface-50 px-4 py-20 dark:border-surface-800 dark:bg-surface-900">
	<div class="mx-auto max-w-5xl">
		<div class="flex items-end justify-between">
			<div>
				<p class="text-sm font-semibold tracking-wide text-primary-500 uppercase">Explore causes</p>
				<h2 class="mt-2 text-3xl font-bold">Support what matters</h2>
				<p class="mt-1 opacity-60">Discover impactful causes. You choose where your yield goes.</p>
			</div>
			<a href="/causes" class="btn hidden preset-tonal sm:inline-flex">View all causes</a>
		</div>

		{#if !FIRSTFRUITS_ADDRESS}
			<p class="mt-8 opacity-50">The vault hasn't been deployed yet.</p>
		{:else if previewCauses.length === 0 && !statsLoading}
			<p class="mt-8 opacity-50">No causes have been created yet.</p>
		{:else}
			<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each previewCauses as cause (cause.id)}
					<div class="flex flex-col gap-2 card p-5">
						<div class="flex items-center justify-between">
							<h3 class="font-semibold">{cause.name}</h3>
							{#if !cause.active}
								<span class="text-xs opacity-50">Inactive</span>
							{/if}
						</div>
						<p class="text-xs opacity-50">
							{cause.recipient.slice(0, 6)}…{cause.recipient.slice(-4)}
						</p>
						<p class="text-sm opacity-75">
							{formatEther(cause.totalHarvestedReth)} rETH received
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<!-- Protocol transparency -->
<section class="px-4 py-20">
	<div class="mx-auto max-w-5xl">
		<h2 class="text-2xl font-bold">Protocol Transparency</h2>
		<p class="mt-1 opacity-60">Firstfruits is non-custodial and open source.</p>

		<div class="mt-6 grid gap-4 sm:grid-cols-2">
			{#each transparency as item (item.label)}
				<div class="card p-5">
					<p class="text-sm font-semibold">{item.label}</p>
					{#if item.value}
						<a href={item.href} target="_blank" rel="noreferrer" class="text-sm text-primary-500">
							{item.value.slice(0, 10)}…{item.value.slice(-8)} ↗
						</a>
					{:else}
						<p class="text-sm opacity-50">Not yet deployed</p>
					{/if}
				</div>
			{/each}
		</div>

		<a
			href="https://github.com/unattended-backpack/firstfruits"
			target="_blank"
			rel="noreferrer"
			class="mt-4 inline-block text-sm text-primary-500"
		>
			View source on GitHub ↗
		</a>
	</div>
</section>

<!-- CTA banner -->
<section class="bg-primary-500/10 px-4 py-12">
	<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
		<div>
			<p class="text-xl font-bold">Start giving what grows.</p>
			<p class="opacity-60">Stake ETH. Earn yield. Change the world.</p>
		</div>
		<button type="button" class="btn preset-filled-primary-500" onclick={openConnectModal}> Connect Wallet → </button>
	</div>
</section>
