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
		{ href: '/', label: 'Home' },
		{ href: '/dashboard', label: 'Vault' },
		{ href: '/causes', label: 'Causes' },
		{ href: '/#how-it-works', label: 'How it works' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<AppBar>
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto] px-14">
		<AppBar.Lead>
			<a href="/" class="flex items-center gap-2">
				<span class="text-xl"><img src={logo} alt="Firstfruits" class="h-8 w-8 brightness-0 dark:invert" /></span>
				<span class="flex flex-col leading-none">
					<span class="text-lg font-semibold">Firstfruits</span>
				</span>
			</a>
		</AppBar.Lead>
		<AppBar.Headline>
			<nav class="flex items-center justify-center gap-6">
				{#each navLinks as link (link.href)}
					<a
						href={link.href}
						class="text-sm"
						class:font-semibold={page.url.pathname === link.href}
						aria-current={page.url.pathname === link.href ? 'page' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</nav>
		</AppBar.Headline>
		<AppBar.Trail>
			<div class="hidden items-center space-x-2 sm:flex">
				{#if !account.isConnected}
					<button type="button" class="mx-2 btn preset-filled text-sm btn-xl" onclick={openConnectModal}>Connect Wallet</button>
				{:else}
					<WalletButton />
				{/if}
				<Lightswitch />
			</div>
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>

<main class="w-full">
	{@render children()}
</main>

<Footer />
