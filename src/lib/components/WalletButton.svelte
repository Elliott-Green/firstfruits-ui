<script lang="ts">
	import { formatEther } from 'ethers';
	import { account } from '$lib/wallet.svelte';
	import { appKit } from '$lib/appkit';
	import { getActiveProvider } from '$lib/contracts/provider';

	let ensName = $state<string | undefined>(undefined);
	let balanceWei = $state<bigint | undefined>(undefined);

	async function load(address: string) {
		ensName = undefined;
		balanceWei = undefined;
		const provider = getActiveProvider();
		const [name, balance] = await Promise.all([
			provider.lookupAddress(address).catch(() => null),
			provider.getBalance(address).catch(() => undefined)
		]);
		ensName = name ?? undefined;
		balanceWei = balance;
	}

	$effect(() => {
		if (account.address) load(account.address);
	});

	function truncate(address: string) {
		return `${address.slice(0, 6)}…${address.slice(-4)}`;
	}

	function openAccountView() {
		appKit?.open({ view: 'Account' });
	}
</script>

{#if account.address}
	<button
		type="button"
		class="justify-text btn flex items-center gap-2 bg-black text-center text-sm text-white dark:bg-white dark:text-black"
		onclick={openAccountView}
	>
		{#if balanceWei !== undefined}
			<span class="text-sm opacity-70">{Number(formatEther(balanceWei)).toFixed(5)} ETH</span>
		{:else}
			<!-- TODO Spinner -->
		{/if}

		<span class="text-[15px]">{ensName ?? truncate(account.address)}</span>
	</button>
{/if}
