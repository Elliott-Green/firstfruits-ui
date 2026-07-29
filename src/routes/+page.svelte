<script lang="ts">
	import { openConnectModal } from '$lib/wallet.svelte';
	import { formatEther } from 'ethers';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';
	import HomeHero from '$lib/components/HomeHero.svelte';
	import { fetchRecentActivity, fetchLatestCauses, type ActivityItem } from '$lib/subgraph';
	import { FIRSTFRUITS_ADDRESS, RETH_ADDRESS } from '$lib/contracts/firstfruits';

	let { data } = $props();
	// No titleTemplate suffix here — the base title is already the full
	// site tagline, so appending "· Firstfruits" would double up.
	const metaTags = $derived(deepMerge(data.baseMetaTags, { titleTemplate: '' }));

	const steps: { icon: string; title: string; body: string; iconScale?: string }[] = [
		{
			icon: `<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>`,
			title: 'Deposit',
			body: 'Deposit ETH or rETH into the vault.'
		},
		{
			icon: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.5-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>`,
			title: 'Earn',
			body: 'ETH is staked which returns rETH to the vault.'
		},
		{
			icon: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
			title: 'Yield',
			body: 'rETH appreciates over time, generating staking yield.'
		},
		{
			icon: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
			title: 'Give',
			body: 'Yield is routed to your chosen causes.'
		},
		{
			icon: `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>`,
			title: 'Withdraw ',
			body: 'Your principal is always yours and withdrawable.'
		}
	];

	const arrowIcon = `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>`;

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

	let activity = $state<ActivityItem[]>([]);
	let causeNames = $state<Map<string, string>>(new Map());
	let activityLoading = $state(true);

	function formatAmount(wei: string): string {
		return Number(formatEther(BigInt(wei))).toLocaleString(undefined, { maximumFractionDigits: 4 });
	}

	function relativeTime(blockTimestamp: string): string {
		const seconds = Date.now() / 1000 - Number(blockTimestamp);
		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}

	function shortAddress(address: string): string {
		return `${address.slice(0, 6)}…${address.slice(-4)}`;
	}

	function activityLabel(item: ActivityItem): { icon: string; label: string; subLabel: string } {
		if (item.kind === 'deposit') {
			return {
				icon: '👛',
				label: 'Vault Deposit',
				subLabel: item.patron ? `From ${shortAddress(item.patron)}` : ''
			};
		}
		if (item.kind === 'yieldAllocated') {
			const name = item.causeId ? (causeNames.get(item.causeId) ?? `Cause #${item.causeId}`) : 'a cause';
			return { icon: '❤️', label: 'Donation Sent', subLabel: name };
		}
		if (item.kind === 'withdrawal') {
			return {
				icon: '📤',
				label: 'Withdrawal',
				subLabel: item.patron ? `By ${shortAddress(item.patron)}` : ''
			};
		}
		if (item.kind === 'causeCreated') {
			return { icon: '🌱', label: 'Cause Created', subLabel: item.name ?? `Cause #${item.causeId}` };
		}
		return { icon: '📈', label: 'Yield Earned', subLabel: '' };
	}

	function activityAmount(item: ActivityItem): string {
		if (item.kind === 'causeCreated') return '';
		if ((item.kind === 'deposit' || item.kind === 'withdrawal') && item.principalAdded) {
			return `${formatAmount(item.principalAdded)} Ξ`;
		}
		if (item.kind === 'withdrawal' && item.etherAmount) {
			return `${formatAmount(item.etherAmount)} Ξ`;
		}
		return item.rethAmount ? `${formatAmount(item.rethAmount)} rETH` : '';
	}

	async function loadActivity() {
		activityLoading = true;
		try {
			const [items, causes] = await Promise.all([fetchRecentActivity(4), fetchLatestCauses(25)]);
			activity = items;
			causeNames = new Map(causes.map((c) => [c.causeId, c.name]));
		} catch {
			// Decorative on the homepage; fail quietly and just hide the feed.
			activity = [];
		} finally {
			activityLoading = false;
		}
	}

	$effect(() => {
		loadActivity();
	});
</script>

<MetaTags {...metaTags} />

<!-- Hero -->
<HomeHero />

<!-- How it works + Recent activity -->
<section class="px-4 py-10 sm:py-12 lg:px-18 lg:py-16">
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- How it works -->
		<div class="flex flex-col card border border-surface-200-800 bg-surface-50-950 p-6 lg:col-span-2">
			<h2 class="text-2xl font-semibold">How Firstfruits Works</h2>

			<!-- Mobile: a plain stacked list, same pattern as Recent Activity — avoids
			     an odd 2-2-1 grid wrap with 5 items leaving the last one orphaned. -->
			<div class="mt-4 flex flex-col divide-y divide-surface-200-800 sm:hidden">
				{#each steps as step, i (step.title)}
					<div class="flex items-center gap-4 py-3">
						<span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600-400">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="26"
								height="26"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								style={step.iconScale ? `transform: ${step.iconScale}` : undefined}
							>
								{@html step.icon}
							</svg>
						</span>
						<div>
							<p class="text-sm font-semibold">{i + 1}. {step.title}</p>
							<p class="mt-0.5 text-xs opacity-60">{step.body}</p>
						</div>
					</div>
				{/each}
			</div>

			<!-- Tablet/desktop: centered icon-over-text columns, full row with arrows at lg. -->
			<div class="mt-8 hidden flex-1 items-center sm:flex">
				<div class="grid w-full grid-cols-3 items-start gap-x-4 gap-y-10 overflow-x-auto lg:flex lg:gap-2 lg:gap-y-0 lg:pb-1">
					{#each steps as step, i (step.title)}
						<div class="flex min-w-0 flex-col items-center gap-4 text-center lg:flex-1">
							<span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600-400">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="34"
									height="34"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									style={step.iconScale ? `transform: ${step.iconScale}` : undefined}
								>
									{@html step.icon}
								</svg>
							</span>
							<div>
								<p class="text-base font-semibold">{i + 1}. {step.title}</p>
								<p class="mt-1.5 text-sm opacity-60">{step.body}</p>
							</div>
						</div>
						{#if i < steps.length - 1}
							<div class="hidden h-20 w-5 shrink-0 items-center justify-center opacity-40 lg:flex">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="22"
									height="22"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									{@html arrowIcon}
								</svg>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>

		<!-- Recent activity -->
		<div class="card border border-surface-200-800 bg-surface-50-950 p-6">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-semibold">Recent Activity</h2>
				{#if FIRSTFRUITS_ADDRESS}
					<a href={`https://etherscan.io/address/${FIRSTFRUITS_ADDRESS}`} target="_blank" rel="noreferrer" class="text-sm text-primary-500"
						>View All</a
					>
				{/if}
			</div>

			<div class="mt-4 flex flex-col divide-y divide-surface-200-800">
				{#if activityLoading}
					<p class="py-6 text-center text-sm opacity-50">Loading…</p>
				{:else if activity.length === 0}
					<p class="py-6 text-center text-sm opacity-50">No activity yet.</p>
				{:else}
					{#each activity as item (item.transactionHash + item.kind)}
						{@const info = activityLabel(item)}
						<div class="flex items-center justify-between gap-3 py-3">
							<div class="flex items-center gap-1">
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
									{info.icon}
								</span>
								<div>
									<p class="text-sm font-medium">{info.label}</p>
									<p class="text-xs opacity-60">{info.subLabel}</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<div class="text-right">
									<p class="text-sm font-medium">{activityAmount(item)}</p>
									<p class="text-xs opacity-50">{relativeTime(item.blockTimestamp)}</p>
								</div>
								<a
									href={`https://etherscan.io/tx/${item.transactionHash}`}
									target="_blank"
									rel="noreferrer"
									title="View on Etherscan"
									class="opacity-50 hover:opacity-100"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="lucide lucide-square-arrow-out-up-right-icon lucide-square-arrow-out-up-right"
										><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" /><path d="m21 3-9 9" /><path d="M15 3h6v6" /></svg
									>
								</a>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</section>

<!-- Protocol transparency -->
<section class="px-4 pb-10 sm:pb-12 lg:px-18 lg:pb-16">
	<div class="card border border-surface-200-800 bg-surface-50-950 p-6 sm:p-8">
		<h2 class="text-lg font-semibold">Protocol Transparency</h2>
		<p class="mt-1 text-sm opacity-60">Firstfruits is non-custodial and open source.</p>

		<div class="mt-6 grid gap-4 sm:grid-cols-2">
			{#each transparency as item (item.label)}
				<div class="rounded-lg bg-surface-100-900 p-4">
					<p class="text-xs opacity-60">{item.label}</p>
					{#if item.value}
						<a href={item.href} target="_blank" rel="noreferrer" class="text-sm break-all text-primary-500">
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
<section class="bg-primary-500/10 px-4 py-10 sm:py-12 lg:px-18 lg:py-16">
	<div class="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
		<div>
			<p class="text-xl font-bold">Start giving what grows.</p>
			<p class="opacity-60">Stake ETH. Earn yield. Change the world.</p>
		</div>
		<button type="button" class="btn w-full justify-center preset-tonal sm:w-auto" onclick={openConnectModal}> Connect Wallet → </button>
	</div>
</section>
