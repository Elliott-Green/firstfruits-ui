<script lang="ts">
	let { address }: { address: string } = $props();

	// Deterministic color from the address, so the same address always gets
	// the same little avatar - no identicon library, just a hashed hue.
	function colorFromAddress(addr: string): string {
		let hash = 0;
		for (let i = 2; i < addr.length; i++) {
			hash = (hash * 31 + addr.charCodeAt(i)) | 0;
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	}

	const bg = $derived(colorFromAddress(address));
	const truncated = $derived(`${address.slice(0, 6)}…${address.slice(-4)}`);
</script>

<a
	href={`https://etherscan.io/address/${address}`}
	target="_blank"
	rel="noreferrer"
	title={truncated}
	aria-label={`View ${truncated} on Etherscan`}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="lucide lucide-user-round-search-icon lucide-user-round-search"
		><circle cx="10" cy="8" r="5" /><path d="M2 21a8 8 0 0 1 10.434-7.62" /><circle cx="18" cy="18" r="3" /><path d="m22 22-1.9-1.9" /></svg
	>
</a>
