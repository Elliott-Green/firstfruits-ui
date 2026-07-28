import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	],
	optimizeDeps: {
		include: ['@reown/appkit', '@reown/appkit-adapter-ethers']
	},

	ssr: {
		// Narrowly targeted: only the one package whose ESM/CJS interop actually
		// breaks under Node's module resolution. A broader match (the whole
		// @reown/@walletconnect families) drags in unrelated transitive deps
		// (@walletconnect/time's raw CJS build, optional Coinbase/x402
		// integrations) that break both `vite build` and `vite dev` SSR.
		noExternal: ['@walletconnect/logger']
	}
});
