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

export type SubgraphCause = {
	causeId: string;
	name: string;
	recipient: string;
	owner: string;
	blockTimestamp: string;
};

/**
 * The most recently created causes (newest first) — for production use,
 * e.g. the homepage marquee. Capped at 25 by default: this is a live
 * cycling display, not a full directory (that's /causes).
 */
export async function fetchLatestCauses(limit = 25): Promise<SubgraphCause[]> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		causeCreateds(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			causeId
			name
			recipient
			owner
			blockTimestamp
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

	return json.data.causeCreateds as SubgraphCause[];
}

// Bytes.fromUTF8("protocol") from the subgraph mapping — the singleton's id.
const PROTOCOL_ID = '0x70726f746f636f6c';

export type ProtocolStats = {
	totalPrincipalEther: string;
	totalYieldDonatedReth: string;
	// BigInt fields are serialized as decimal strings over GraphQL.
	causeCount: string;
	patronCount: string;
};

/**
 * Protocol-wide running totals, including patronCount — the contract has no
 * patron counter itself (no enumeration on the `patrons` mapping), so this
 * is the only way to get a "total patrons" number: the subgraph counts
 * unique addresses that have ever emitted a Deposited event.
 */
export async function fetchProtocolStats(): Promise<ProtocolStats | undefined> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		protocol(id: "${PROTOCOL_ID}") {
			totalPrincipalEther
			totalYieldDonatedReth
			causeCount
			patronCount
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

	return json.data.protocol as ProtocolStats | undefined;
}

export type ActivityItem = {
	kind: 'deposit' | 'yieldAllocated' | 'harvested' | 'withdrawal' | 'causeCreated';
	patron?: string;
	rethAmount?: string;
	principalAdded?: string;
	etherAmount?: string;
	causeId?: string;
	name?: string;
	blockTimestamp: string;
	transactionHash: string;
};

/**
 * The most recent on-chain activity, merged from five different event types
 * (deposits, yield allocated to causes, harvests, withdrawals in either
 * form, and new causes) and sorted by time. There's no single "activity"
 * entity — this stitches them together client-side from one request.
 */
export async function fetchRecentActivity(limit = 5): Promise<ActivityItem[]> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		depositeds(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			patron rethAmount principalAdded blockTimestamp transactionHash
		}
		yieldAllocateds(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			patron causeId rethAmount blockTimestamp transactionHash
		}
		harvesteds(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			patron rethAmount blockTimestamp transactionHash
		}
		withdrawns(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			patron etherAmount blockTimestamp transactionHash
		}
		withdrawnReths(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			patron rethAmount blockTimestamp transactionHash
		}
		causeCreateds(orderBy: blockTimestamp, orderDirection: desc, first: ${limit}) {
			causeId name blockTimestamp transactionHash
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

	const tag = (kind: ActivityItem['kind']) => (d: Record<string, string>) => ({ kind, ...d });

	const all: ActivityItem[] = ([] as ActivityItem[]).concat(
		json.data.depositeds.map(tag('deposit')),
		json.data.yieldAllocateds.map(tag('yieldAllocated')),
		json.data.harvesteds.map(tag('harvested')),
		json.data.withdrawns.map(tag('withdrawal')),
		json.data.withdrawnReths.map(tag('withdrawal')),
		json.data.causeCreateds.map(tag('causeCreated'))
	);

	return all.sort((a, b) => Number(b.blockTimestamp) - Number(a.blockTimestamp)).slice(0, limit);
}
