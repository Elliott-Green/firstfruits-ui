<script lang="ts">
	import { Contract, formatEther } from 'ethers';
	import VaultOverviewPreview from '$lib/components/VaultOverviewPreview.svelte';
	import AddressAvatarLink from '$lib/components/AddressAvatarLink.svelte';
	import RocketPoolLogo from '$lib/assets/rp_logo.svg';

	import { Marquee } from '@skeletonlabs/skeleton-svelte';
	import { fetchLatestCauses } from '$lib/subgraph';
	import { isCauseCurated } from '$lib/curatedCauses';
	import { getActiveProvider } from '$lib/contracts/provider';
	import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';

	function formatAmount(wei: bigint): string {
		return Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 4 });
	}

	type MarqueeItem = {
		causeId: string;
		name: string;
		curated: boolean;
		active: boolean;
		owner: string;
		recipient: string;
		totalHarvestedReth: bigint;
	};

	let items = $state<MarqueeItem[]>([]);

	// The subgraph only knows what was true at creation (CauseCreated's
	// name/owner/recipient) — it doesn't track later ownership transfers,
	// active/inactive toggles, or harvested totals. So we use it just to get
	// the ordered ID list, then read live state straight from the contract
	// per cause, same as the /causes page does.
	async function hydrateWithChainData(base: { causeId: string; name: string; curated: boolean }[]): Promise<MarqueeItem[]> {
		if (!FIRSTFRUITS_ADDRESS || base.length === 0) return [];
		const vault = new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, getActiveProvider());
		return Promise.all(
			base.map(async (b) => {
				const [owner, , recipient, active, , , totalHarvestedReth] = await vault.causes(b.causeId);
				return { ...b, owner, recipient, active, totalHarvestedReth };
			})
		);
	}

	async function loadItems() {
		try {
			const causes = await fetchLatestCauses(25);
			const base = causes.map((c) => ({
				causeId: c.causeId,
				name: c.name,
				curated: isCauseCurated(c.causeId)
			}));
			items = await hydrateWithChainData(base);
		} catch {
			// No subgraph configured, or nothing indexed yet — just don't show
			// the marquee rather than fake it.
			items = [];
		}
	}

	$effect(() => {
		loadItems();
	});
</script>

<section class="border-surface-200-800 bg-surface-50-950 px-4 py-10 sm:py-12 lg:px-18 lg:py-28">
	<div class="grid items-center gap-12 pb-10 sm:pb-12 lg:grid-cols-2 lg:gap-10 lg:pb-32">
		<div>
			<span class="mb-6 badge inline-flex items-center gap-3 preset-tonal px-4">
				<img src={RocketPoolLogo} alt="rocketpool logo" class="w-8" />
				<span class="text-lg">Built with rETH</span>
			</span>

			<h1 class="text-4xl leading-tight font-bold sm:text-5xl lg:text-6xl">
				Stake ETH.
				<br />
				<span class="text-primary-500">Give what grows.</span>
			</h1>

			<p class="mt-6 text-lg opacity-70 sm:text-xl lg:pr-16">
				Firstfruits is a charitable-giving vault. Stake ETH, earn staking yield via rETH, and we route the yield to causes you care about.
				Your principal stays yours and is withdrawable anytime.
			</p>

			<div class="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
				<a href="/dashboard" class="btn justify-center preset-tonal btn-xl"> Stake ETH Now → </a>
				<a href="/causes" class="btn justify-center preset-tonal btn-xl">Explore Causes</a>
			</div>

			<div class="mt-10 grid grid-cols-1 gap-5 text-sm sm:grid-cols-3 sm:gap-4">
				<div class="flex items-start gap-3">
					<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
						</svg>
					</span>
					<div>
						<p class="font-semibold">Principal always yours</p>
						<p class="opacity-60">Withdraw your ETH anytime.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.5-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z" />
						</svg>
					</span>
					<div>
						<p class="font-semibold">Powered by rETH</p>
						<p class="opacity-60">Secure liquid staking.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
							/>
						</svg>
					</span>
					<div>
						<p class="font-semibold">Give automatically</p>
						<p class="opacity-60">Yield routed based on your splits.</p>
					</div>
				</div>
			</div>
		</div>

		<VaultOverviewPreview />
	</div>

	{#if items.length > 0}
		<Marquee autoFill pauseOnInteraction speed={100}>
			<Marquee.Edge side="start" />
			<Marquee.Viewport>
				<Marquee.Context>
					{#snippet children(marquee)}
						{#each Array.from({ length: marquee().contentCount }) as _, index}
							<Marquee.Content {index}>
								{#each items as item (item.causeId)}
									<div class="flex items-center gap-4 card border border-surface-200-800 bg-surface-100-900 px-6 py-4 whitespace-nowrap">
										<div class="flex items-center gap-2">
											{#if item.curated}
												<span class="text-amber-500" title="Curated cause">⭐</span>
											{/if}
											<span class="font-medium">{item.name}</span>
											{#if !item.active}
												<span class="text-xs opacity-50">Inactive</span>
											{/if}
										</div>
										<span class="text-sm opacity-60">{formatAmount(item.totalHarvestedReth)} rETH raised</span>
										<div class="flex items-center -space-x-1.5">
											<AddressAvatarLink address={item.owner} />
											{#if item.recipient.toLowerCase() !== item.owner.toLowerCase()}
												<AddressAvatarLink address={item.recipient} />
											{/if}
										</div>
									</div>
								{/each}
							</Marquee.Content>
						{/each}
					{/snippet}
				</Marquee.Context>
			</Marquee.Viewport>
			<Marquee.Edge side="end" />
		</Marquee>
	{/if}
</section>
