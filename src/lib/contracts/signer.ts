import { BrowserProvider, Contract, type Eip1193Provider, type JsonRpcSigner } from 'ethers';
import { appKit } from '$lib/appkit';
import { FIRSTFRUITS_ADDRESS, RETH_ADDRESS, firstfruitsAbi } from '$lib/contracts/firstfruits';
import { erc20Abi } from '$lib/contracts/erc20';

async function getSigner(): Promise<JsonRpcSigner> {
	const walletProvider = appKit?.getWalletProvider();
	if (!walletProvider) throw new Error('No wallet connected.');

	const browserProvider = new BrowserProvider(walletProvider as Eip1193Provider);
	return browserProvider.getSigner();
}

/** Vault contract connected to the active wallet's signer, for write calls. */
export async function getVaultWithSigner(): Promise<Contract> {
	if (!FIRSTFRUITS_ADDRESS) throw new Error('Vault address is not configured.');
	const signer = await getSigner();
	return new Contract(FIRSTFRUITS_ADDRESS, firstfruitsAbi, signer);
}

/** rETH token contract connected to the active wallet's signer — for the
 * allowance check + approve() that depositRethAndDesignate needs before it
 * can transferFrom the patron's rETH. */
export async function getRethWithSigner(): Promise<Contract> {
	if (!RETH_ADDRESS) throw new Error('rETH address is not configured.');
	const signer = await getSigner();
	return new Contract(RETH_ADDRESS, erc20Abi, signer);
}
