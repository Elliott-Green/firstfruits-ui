import { RETH_ADDRESS } from '$lib/contracts/firstfruits';

const ETH_COIN_ID = 'coingecko:ethereum';

export type UsdPrices = {
	ethUsd: number | undefined;
	rethUsd: number | undefined;
};

/** Current ETH and rETH USD prices from DefiLlama's free coins API. */
export async function fetchUsdPrices(): Promise<UsdPrices> {
	const coinIds = RETH_ADDRESS ? `${ETH_COIN_ID},ethereum:${RETH_ADDRESS}` : ETH_COIN_ID;
	const res = await fetch(`https://coins.llama.fi/prices/current/${coinIds}`);
	if (!res.ok) throw new Error(`Price request failed: ${res.status}`);

	const json = await res.json();
	return {
		ethUsd: json.coins?.[ETH_COIN_ID]?.price,
		rethUsd: RETH_ADDRESS ? json.coins?.[`ethereum:${RETH_ADDRESS}`]?.price : undefined
	};
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
