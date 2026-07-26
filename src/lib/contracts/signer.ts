import { BrowserProvider, Contract, type Eip1193Provider } from 'ethers';
import { appKit } from '$lib/appkit';
import { FIRSTFRUITS_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';

/** Vault contract connected to the active wallet's signer, for write calls. */
export async function getVaultWithSigner(): Promise<Contract> {
	if (!FIRSTFRUITS_ADDRESS) throw new Error('Vault address is not configured.');
	const walletProvider = appKit?.getWalletProvider();
	if (!walletProvider) throw new Error('No wallet connected.');

	const browserProvider = new BrowserProvider(walletProvider as Eip1193Provider);
	const signer = await browserProvider.getSigner();
	return new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, signer);
}
