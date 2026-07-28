import { Contract } from 'ethers';
import { getActiveProvider } from '$lib/contracts/provider';
import { RETH_ADDRESS } from '$lib/contracts/firstfruits';

const rethRateAbi = ['function getExchangeRate() view returns (uint256)'];

/**
 * Live rETH → ETH exchange rate (18-decimal fixed point — 1e18 means 1 rETH
 * redeems for exactly 1 ETH). This is RocketPool's own redemption rate, not a
 * market price, so it's the correct number to convert an rETH amount to its
 * ETH-equivalent value before pricing it in USD — using a separately-quoted
 * rETH market price would price against secondary-market sentiment rather
 * than what the rETH is actually redeemable for.
 */
export async function fetchRethExchangeRate(): Promise<bigint> {
	if (!RETH_ADDRESS) throw new Error('rETH address is not configured.');
	const reth = new Contract(RETH_ADDRESS, rethRateAbi, getActiveProvider());
	return reth.getExchangeRate();
}
