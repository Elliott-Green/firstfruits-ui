import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
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
	ssr: {
		// $lib/wallet.svelte.ts imports the live `appKit` value from $lib/appkit,
		// which pulls in @reown/appkit at module scope (its own `if (browser)`
		// guard only stops the *code* from running during SSR, not the import
		// from being resolved). Vite's default SSR behavior externalizes
		// node_modules packages, leaving this one for Node to resolve directly —
		// and Node's CJS/ESM interop can't find @walletconnect/logger's named
		// exports through @reown/appkit-wallet's bundle, crashing every SSR
		// request. Forcing these to be bundled by Vite/Rollup instead (which
		// handles the interop correctly) fixes it.
		noExternal: [/^@reown\//, /^@walletconnect\//]
	}
});
