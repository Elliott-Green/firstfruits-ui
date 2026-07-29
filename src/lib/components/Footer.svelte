<script lang="ts">
	import logo from '$lib/assets/logo.png';

	const year = new Date().getFullYear();

	const resources = [
		{ label: 'RocketPool Docs', href: 'https://docs.rocketpool.net/liquid-staking/overview' },
		{ label: 'Contracts', href: 'https://github.com/unattended-backpack/firstfruits/tree/master' },
		{ label: 'UI Source', href: 'https://github.com/unattended-backpack/firstfruits-ui/tree/master' }
	];
</script>

<footer class="border-t border-surface-200-800 bg-surface-50-950">
	<div class="px-4 py-10 sm:py-12 lg:px-18 lg:py-16">
		<div class="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[2fr_1fr_1fr]">
			<div>
				<a href="/" class="flex items-center gap-2">
					<img src={logo} alt="Firstfruits" class="h-7 w-7 brightness-0 dark:invert" />
					<span class="text-lg font-semibold">Firstfruits</span>
				</a>
				<p class="mt-3 text-sm opacity-60">
					A charitable-giving vault built with rETH. Stake ETH, donate the yield, keep your principal.
				</p>
			</div>
			<!-- Pure spacer column for the 3-col desktop layout - hidden below lg so
			     it doesn't stack in as a dead empty block on mobile/tablet. -->
			<div class="hidden lg:block"></div>
			<div>
				<h2 class="text-xs font-semibold tracking-wide uppercase opacity-60">Resources</h2>
				<ul class="mt-4 space-y-3 text-sm">
					{#each resources as item (item.href)}
						<li>
							<a href={item.href} target="_blank" rel="noreferrer" class="opacity-80 hover:text-primary-500 hover:opacity-100"
								>{item.label}</a
							>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div
			class="mt-10 flex flex-col gap-2 border-t border-surface-200-800 pt-6 text-xs opacity-70 sm:flex-row sm:items-center sm:justify-between"
		>
			<span>VPL Copyleft {year} Firstfruits. Non-custodial and open source.</span>
			<span>"Honour the Lord with thy substance, and with the firstfruits of all thine increase."</span>
		</div>
	</div>
</footer>
