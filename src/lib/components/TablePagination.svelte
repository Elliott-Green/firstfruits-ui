<script lang="ts">
	import { Pagination, type usePagination } from '@skeletonlabs/skeleton-svelte';

	let { pagination }: { pagination: ReturnType<typeof usePagination> } = $props();
</script>

{#if pagination().totalPages > 1}
	<Pagination.Provider value={pagination}>
		<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
			<p class="text-xs opacity-60">
				{pagination().pageRange.start + 1}–{pagination().pageRange.end} of {pagination().count}
			</p>
			<div class="flex items-center gap-1">
				<Pagination.PrevTrigger class="btn-icon preset-tonal btn-sm disabled:opacity-40">←</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(api)}
						{#each api().pages as p, i (i)}
							{#if p.type === 'page'}
								<Pagination.Item
									type="page"
									value={p.value}
									class="btn-icon btn-sm {p.value === api().page ? 'preset-filled' : 'preset-tonal'}"
								>
									{p.value}
								</Pagination.Item>
							{:else}
								<Pagination.Ellipsis index={i} class="px-1 text-sm opacity-50">…</Pagination.Ellipsis>
							{/if}
						{/each}
					{/snippet}
				</Pagination.Context>
				<Pagination.NextTrigger class="btn-icon preset-tonal btn-sm disabled:opacity-40">→</Pagination.NextTrigger>
			</div>
		</div>
	</Pagination.Provider>
{/if}
