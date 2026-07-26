import { browser } from '$app/environment';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet } from '@reown/appkit/networks';
import { writable } from 'svelte/store';

// Only initialize in browser environment
export let appKit: ReturnType<typeof createAppKit> | undefined = undefined;

if (browser) {
	const projectId = import.meta.env.VITE_PROJECT_ID;
	if (!projectId) {
		throw new Error('VITE_PROJECT_ID is not set');
	}

	// localStorage only exists in the browser — reading it up here (inside
	// the `if (browser)` block) instead of at module top-level avoids
	// crashing SSR, which evaluates this whole file in Node first.
	//
	// The site defaults to light (see app.html) unless the user has
	// explicitly stored 'dark'. AppKit's theme should always be the
	// *opposite* of the site's current mode.
	const siteMode = localStorage.getItem('mode') === 'dark' ? 'dark' : 'light';
	const appKitMode = siteMode === 'dark' ? 'light' : 'dark';

	appKit = createAppKit({
		adapters: [new EthersAdapter()],
		networks: [mainnet],
		defaultNetwork: mainnet,
		projectId,

		metadata: {
			name: 'FirstFruits',
			description: `Charitable giving on Ethereum. Patrons stake Ether, which the vault converts to Rocket Pool rETH. Principal stays the patron's and is withdrawable at any time; staking yield is directed to causes of the patron's choosing, in percentages they choose.`,
			// TODO
			url: 'http://localhost:5173',
			icons: ['https://avatars.githubusercontent.com/u/179229932?s=200&v=4']
		},
		features: {
			send: false,
			receive: false,
			swaps: false
		},
		themeMode: appKitMode
	});
}

export const appKitStore = writable(appKit);
