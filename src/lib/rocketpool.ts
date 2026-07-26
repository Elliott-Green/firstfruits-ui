// rETH's DefiLlama yield-pool id — https://defillama.com/yields/pool/d4b3c522-6127-4b89-bedf-83641cdcd2eb
const RETH_POOL_ID = 'd4b3c522-6127-4b89-bedf-83641cdcd2eb';

export type ApyPoint = {
	timestamp: string;
	apy: number;
};

/**
 * Rocket Pool's staking APY (rETH), plus recent history, from DefiLlama's
 * free public yields API. No API key required.
 */
export async function fetchRethApyHistory(): Promise<ApyPoint[]> {
	const res = await fetch(`https://yields.llama.fi/chart/${RETH_POOL_ID}`);
	if (!res.ok) throw new Error(`DefiLlama request failed: ${res.status}`);
	const json = await res.json();
	return (json.data as { timestamp: string; apy: number }[]).map((d) => ({
		timestamp: d.timestamp,
		apy: d.apy
	}));
}
