<script lang="ts">
	import { isAddress } from 'ethers';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { MetaTags, deepMerge } from 'svelte-meta-tags';
	import { page } from '$app/state';
	import { account, openConnectModal } from '$lib/wallet.svelte';
	import { getVaultWithSigner } from '$lib/contracts/signer';
	import { FIRSTFRUITS_ADDRESS } from '$lib/contracts/firstfruits';
	import { getContractErrorMessage } from '$lib/errors';
	import { ogImageUrl } from '$lib/og';

	const PAGE_TITLE = 'Create a Cause';
	const PAGE_DESCRIPTION = 'Permissionlessly create a new cause for Firstfruits patrons to route their staking yield to.';

	let { data } = $props();
	const metaTags = $derived.by(() => {
		const image = ogImageUrl(page.url.origin, PAGE_TITLE, PAGE_DESCRIPTION);
		return deepMerge(data.baseMetaTags, {
			title: PAGE_TITLE,
			description: PAGE_DESCRIPTION,
			openGraph: { title: PAGE_TITLE, images: [{ url: image, width: 1200, height: 630, alt: PAGE_TITLE }] },
			twitter: { title: PAGE_TITLE, image }
		});
	});

	let ownerAddress = $state('');
	let recipientAddress = $state('');
	let causeName = $state('');
	let creating = $state(false);
	let errorModalMessage = $state<string | undefined>(undefined);
	let createdCauseId = $state<string | undefined>(undefined);

	function resetForm() {
		createdCauseId = undefined;
		ownerAddress = '';
		recipientAddress = '';
		causeName = '';
	}

	async function createCause() {
		const owner = ownerAddress.trim();
		const recipient = recipientAddress.trim();
		const name = causeName.trim();

		if (!isAddress(owner)) {
			errorModalMessage = 'Enter a valid cause owner address.';
			return;
		}
		if (!isAddress(recipient)) {
			errorModalMessage = 'Enter a valid recipient address.';
			return;
		}
		if (!name) {
			errorModalMessage = 'Enter a name for this cause.';
			return;
		}

		creating = true;
		try {
			const vault = await getVaultWithSigner();
			const tx = await vault.createCause(owner, recipient, name);
			const receipt = await tx.wait();
			const created = receipt.logs
				.map((log: unknown) => {
					try {
						return vault.interface.parseLog(log as { topics: string[]; data: string });
					} catch {
						return null;
					}
				})
				.find((parsed: { name: string } | null) => parsed?.name === 'CauseCreated');
			createdCauseId = created ? created.args.causeId.toString() : undefined;
		} catch (e) {
			errorModalMessage = getContractErrorMessage(e, 'Failed to create cause.');
		} finally {
			creating = false;
		}
	}
</script>

<MetaTags {...metaTags} />

<div class="px-4 py-8 lg:px-18">
	<a href="/causes" class="inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">← Back to causes</a>
	<h1 class="mt-2 text-3xl font-bold">Create a Cause</h1>
	<p class="mt-1 text-sm opacity-60">Add a new cause for patrons to route their yield to.</p>

	<div class="mt-6">
		{#if !account.isConnected}
			<div class="flex flex-col items-center gap-4 card p-10 text-center">
				<p class="opacity-75">Connect your wallet to create a cause.</p>
				<button type="button" class="btn preset-tonal" onclick={openConnectModal}>Connect wallet</button>
			</div>
		{:else if !FIRSTFRUITS_ADDRESS}
			<div class="card p-10 text-center opacity-75">
				The vault hasn't been deployed yet - set <code>VITE_FIRSTFRUITS_ADDRESS</code> once it is.
			</div>
		{:else if createdCauseId}
			<div class="card border border-surface-200-800 bg-surface-50-950 p-8 text-center">
				<span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
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
					>
						<path d="M20 6 9 17l-5-5" />
					</svg>
				</span>
				<h2 class="mt-4 text-lg font-semibold">Cause created</h2>
				<p class="mt-1 text-sm opacity-60">Cause #{createdCauseId} is live - patrons can start allocating yield to it now.</p>
				<div class="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
					<a href="/causes" class="btn preset-tonal">View all causes</a>
					<button type="button" class="btn preset-tonal" onclick={resetForm}>Create another</button>
				</div>
			</div>
		{:else}
			{#snippet addressField(id: string, label: string, help: string, value: string, setValue: (value: string) => void)}
				<div>
					<label for={id} class="text-sm font-medium">{label}</label>
					<p class="mt-0.5 text-xs opacity-60">{help}</p>
					<div class="relative mt-2">
						<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center opacity-40">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
								<path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
								<path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
							</svg>
						</span>
						<input
							{id}
							type="text"
							placeholder="0x…"
							{value}
							oninput={(e) => setValue(e.currentTarget.value)}
							class="input w-full pl-9"
							disabled={creating}
						/>
					</div>
				</div>
			{/snippet}

			<div class="card border border-surface-200-800 bg-surface-50-950 p-6 sm:p-8">
				<div class="flex items-center gap-4">
					<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-600-400">
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
						<h2 class="text-lg font-semibold">Cause details</h2>
						<p class="text-sm opacity-60">Fill in the information below to create a new cause.</p>
					</div>
				</div>

				<hr class="mt-6 border-surface-200-800" />

				<div class="mt-6 flex flex-col gap-6">
					{@render addressField(
						'owner-address',
						'Cause Owner',
						'The address that manages this cause.',
						ownerAddress,
						(v) => (ownerAddress = v)
					)}

					{@render addressField(
						'recipient-address',
						'Recipient Address',
						'The address that will receive the yield allocated to this cause. If the charity or cause has an EVM address, this should be that address.',
						recipientAddress,
						(v) => (recipientAddress = v)
					)}

					<div>
						<label for="cause-name" class="text-sm font-medium">Cause Name</label>
						<p class="mt-0.5 text-xs opacity-60">A recognizable name for this cause.</p>
						<div class="relative mt-2">
							<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center opacity-40">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
									<path d="M14 2v6h6" />
								</svg>
							</span>
							<input
								id="cause-name"
								type="text"
								placeholder="e.g. Ocean Cleanup"
								bind:value={causeName}
								class="input w-full pl-9"
								disabled={creating}
							/>
						</div>
					</div>
				</div>

				<div class="mt-6 flex items-start gap-3 rounded-lg bg-surface-100-900 p-4 text-sm">
					<span class="mt-0.5 shrink-0 text-primary-600-400">
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
						>
							<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
							<path d="m9 12 2 2 4-4" />
						</svg>
					</span>
					<p class="opacity-70">
						By creating a cause, you confirm that the information provided is accurate. The name is permanent, but the owner, recipient, and
						status can all be changed later by the cause's owner.
					</p>
				</div>

				<button type="button" class="mt-6 btn w-full justify-center preset-tonal" disabled={creating} onclick={createCause}>
					{creating ? 'Creating…' : '+ Create Cause'}
				</button>
			</div>
		{/if}
	</div>
</div>

<Dialog
	open={errorModalMessage !== undefined}
	onOpenChange={(d: { open: boolean }) => {
		if (!d.open) errorModalMessage = undefined;
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-40 bg-black/50" />
		<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<Dialog.Content class="w-full max-w-md card border border-surface-200-800 bg-surface-50-950 p-6">
				<Dialog.Title class="text-lg font-semibold text-red-500">Something went wrong</Dialog.Title>
				<Dialog.Description class="mt-2 text-sm opacity-70">{errorModalMessage}</Dialog.Description>
				<div class="mt-6 flex justify-end">
					<Dialog.CloseTrigger class="btn preset-tonal">Close</Dialog.CloseTrigger>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
