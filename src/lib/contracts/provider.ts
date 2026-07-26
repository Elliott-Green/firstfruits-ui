import { BrowserProvider, JsonRpcProvider, type Eip1193Provider } from 'ethers';
import { appKit } from '$lib/appkit';
import { account } from '$lib/wallet.svelte';

// Fallback for reads that don't require a connected wallet (e.g. browsing
// causes, or when nobody's connected yet).
export const readProvider = new JsonRpcProvider(import.meta.env.VITE_RPC_URL);

/**
 * The best available provider for reads: the connected wallet's own RPC when
 * one is connected, otherwise our public fallback. Avoids routing every read
 * through a third-party RPC we don't control when the user already has one.
 */
export function getActiveProvider() {
	if (account.isConnected) {
		const walletProvider = appKit?.getWalletProvider();
		if (walletProvider) return new BrowserProvider(walletProvider as Eip1193Provider);
	}
	return readProvider;
}
