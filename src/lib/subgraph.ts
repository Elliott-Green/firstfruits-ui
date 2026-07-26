const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL as string | undefined;

export type DailySnapshot = {
	dayId: number;
	dayStartTimestamp: string;
	totalPrincipalEther: string;
	totalYieldDonatedReth: string;
};

/**
 * Daily protocol snapshots from our subgraph, ascending by day (oldest
 * first) — ready to feed straight into a chart.
 */
export async function fetchDailySnapshots(days = 30): Promise<DailySnapshot[]> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		dailySnapshots(orderBy: dayId, orderDirection: desc, first: ${days}) {
			dayId
			dayStartTimestamp
			totalPrincipalEther
			totalYieldDonatedReth
		}
	}`;

	const res = await fetch(SUBGRAPH_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query })
	});
	if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);

	const json = await res.json();
	if (json.errors) throw new Error(json.errors[0]?.message ?? 'Subgraph query error');

	return (json.data.dailySnapshots as DailySnapshot[]).slice().reverse();
}
