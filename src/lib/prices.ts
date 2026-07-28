import { formatEther } from 'ethers';

const ETH_COIN_ID = 'coingecko:ethereum';

export type UsdPrices = {
	ethUsd: number | undefined;
};

/** Current ETH USD price from DefiLlama's free coins API. */
export async function fetchUsdPrices(): Promise<UsdPrices> {
	const res = await fetch(`https://coins.llama.fi/prices/current/${ETH_COIN_ID}`);
	if (!res.ok) throw new Error(`Price request failed: ${res.status}`);

	const json = await res.json();
	return { ethUsd: json.coins?.[ETH_COIN_ID]?.price };
}

/**
 * USD value of an rETH amount, converted through its actual redemption rate
 * rather than a separately-quoted rETH market price. Deliberately doesn't
 * fetch a "rETH USD price" at all — rETH has no yield or accrual of its own
 * in USD terms beyond "however much ETH it redeems for, priced in USD", so
 * going rETH → ETH (via the live exchange rate) → USD (via the ETH price) is
 * the correct conversion, not rETH-wei-quantity × some rETH-denominated price.
 */
export function convertRethToUsd(rethWei: bigint, exchangeRateWei: bigint, ethUsdPrice: number): number {
	const ethEquivalentWei = (rethWei * exchangeRateWei) / 10n ** 18n;
	return Number(formatEther(ethEquivalentWei)) * ethUsdPrice;
}

export function formatUsd(amount: number): string {
	// Force en-US rather than the runtime's default locale — some locales
	// (en-AU, en-CA, en-NZ, ...) render USD as "US$" instead of "$".
	return amount.toLocaleString('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: amount < 1000 ? 2 : 0
	});
}
