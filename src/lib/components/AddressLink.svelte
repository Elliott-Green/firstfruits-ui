<script lang="ts">
	let { address, ensName }: { address: string; ensName?: string | null } = $props();

	const truncated = $derived(`${address.slice(0, 6)}…${address.slice(-4)}`);
	const label = $derived(ensName ?? truncated);
</script>

<a
	href={`https://etherscan.io/address/${address}`}
	target="_blank"
	rel="noreferrer"
	title={address}
	class="inline-flex items-center gap-1 text-primary-500 hover:text-primary-800-200 hover:underline"
>
	{label}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="12"
		height="12"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="shrink-0"
		><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" /><path d="m21 3-9 9" /><path d="M15 3h6v6" /></svg
	>
</a>
