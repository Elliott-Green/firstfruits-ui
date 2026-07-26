<script lang="ts">
	import { browser } from '$app/environment';

	const sceneUrl = import.meta.env.VITE_SPLINE_SCENE_URL as string | undefined;

	// Registers the `<spline-viewer>` custom element; only needed client-side.
	if (browser && sceneUrl) {
		import('@splinetool/viewer');
	}
</script>

{#if sceneUrl}
	<spline-viewer url={sceneUrl} class="h-full w-full"></spline-viewer>
{/if}
