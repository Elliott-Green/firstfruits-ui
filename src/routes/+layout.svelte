<script lang="ts">
	import './layout.css';
	import '$lib/appkit';

	import logo from '$lib/assets/logo.png';

	import favicon from '$lib/assets/favicon.svg';
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import Lightswitch from '$lib/components/Lightswitch.svelte';
	import WalletButton from '$lib/components/WalletButton.svelte';
	import Footer from '$lib/components/Footer.svelte';

	import { page } from '$app/state';
	import { account, openConnectModal } from '$lib/wallet.svelte';
	let { children } = $props();

	const navLinks = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/causes', label: 'Causes' },
		{ href: '/patrons', label: 'Patrons' },
	];

	let mobileMenuOpen = $state(false);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<AppBar>
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto] px-4 sm:px-6 lg:px-14">
		<AppBar.Lead>
			<a href="/" class="flex items-center gap-2">
				<span class="text-xl"><img src={logo} alt="Firstfruits" class="h-8 w-8 brightness-0 dark:invert" /></span>
				<span class="flex flex-col leading-none">
					<span class="text-lg font-semibold">Firstfruits</span>
				</span>
			</a>
		</AppBar.Lead>
		<AppBar.Headline>
			<nav class="hidden items-center justify-center gap-6 md:flex">
				{#each navLinks as link (link.href)}
					<a
						href={link.href}
						class="-mb-4 border-b-2 pb-5 text-sm transition-colors"
						class:border-primary-500={page.url.pathname === link.href}
						class:border-transparent={page.url.pathname !== link.href}
						class:text-primary-500={page.url.pathname === link.href}
						class:font-semibold={page.url.pathname === link.href}
						aria-current={page.url.pathname === link.href ? 'page' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</nav>
		</AppBar.Headline>
		<AppBar.Trail>
			<div class="flex items-center gap-2">
				{#if !account.isConnected}
					<button type="button" class="btn preset-filled text-sm" onclick={openConnectModal}>
						<span class="hidden sm:inline">Connect Wallet</span>
						<span class="sm:hidden">Connect</span>
					</button>
				{:else}
					<WalletButton />
				{/if}
				<Lightswitch />
				<button
					type="button"
					class="btn-icon preset-tonal md:hidden"
					aria-label="Toggle menu"
					aria-expanded={mobileMenuOpen}
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
				>
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
						{#if mobileMenuOpen}
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						{:else}
							<line x1="4" y1="6" x2="20" y2="6" />
							<line x1="4" y1="12" x2="20" y2="12" />
							<line x1="4" y1="18" x2="20" y2="18" />
						{/if}
					</svg>
				</button>
			</div>
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>

{#if mobileMenuOpen}
	<nav class="flex flex-col border-b border-surface-200-800 bg-surface-50-950 px-4 py-2 md:hidden">
		{#each navLinks as link (link.href)}
			<a
				href={link.href}
				class="rounded-lg px-2 py-3 text-sm"
				class:font-semibold={page.url.pathname === link.href}
				class:text-primary-500={page.url.pathname === link.href}
				aria-current={page.url.pathname === link.href ? 'page' : undefined}
				onclick={() => (mobileMenuOpen = false)}
			>
				{link.label}
			</a>
		{/each}
	</nav>
{/if}

<main class="w-full">
	{@render children()}
</main>

<Footer />
