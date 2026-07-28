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

/**
 * Distinct patron count per cause, keyed by causeId. There's no direct
 * "supporter count" on-chain or in the subgraph schema — this derives it from
 * YieldAllocated events (every patron who's ever had yield routed to a cause
 * shows up there at least once), which is the closest honest signal we have
 * to "how many people are supporting this cause" without a dedicated
 * per-cause-per-patron entity. It's a lifetime count (anyone who's ever sent
 * yield here), not "currently allocating" — a patron who later changed their
 * split away from this cause still counts.
 */
export async function fetchCauseSupporterCounts(): Promise<Map<string, number>> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		yieldAllocateds(first: 1000) {
			patron
			causeId
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

	const patronsByCause = new Map<string, Set<string>>();
	for (const row of json.data.yieldAllocateds as { patron: string; causeId: string }[]) {
		const set = patronsByCause.get(row.causeId) ?? new Set<string>();
		set.add(row.patron.toLowerCase());
		patronsByCause.set(row.causeId, set);
	}

	return new Map([...patronsByCause].map(([causeId, patrons]) => [causeId, patrons.size]));
}

/**
 * Lifetime total yield a single patron has routed to causes, in rETH — summed
 * client-side from their YieldAllocated events since there's no per-patron
 * running total in the schema (Patron only tracks firstDepositTimestamp/
 * active). Bounded to the first 1000 events, which is generous for a single
 * address given MAX_ALLOCATIONS caps how often this can fire per harvest.
 */
export async function fetchPatronTotalDonatedReth(patron: string): Promise<bigint> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		yieldAllocateds(first: 1000, where: { patron: "${patron.toLowerCase()}" }) {
			rethAmount
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

	return (json.data.yieldAllocateds as { rethAmount: string }[]).reduce((sum, row) => sum + BigInt(row.rethAmount), 0n);
}

export type PatronLeaderboardRow = {
	address: string;
	firstDepositTimestamp: number;
	active: boolean;
	// Lifetime totals — a patron who has since withdrawn keeps their history.
	totalDepositedEther: bigint;
	totalDonatedReth: bigint;
};

/**
 * Every patron who's ever deposited, with lifetime deposited/donated totals —
 * the data behind a leaderboard. This is the expensive query in this file:
 * there's no per-patron running total in the schema (Patron only tracks
 * firstDepositTimestamp/active), so it pulls the full Deposited and
 * YieldAllocated event lists and reduces them client-side. Bounded to the
 * first 1000 of each, same as the other list queries here — fine for now,
 * but the first thing to revisit (cursor-paginate) once the protocol has
 * more history than that. Callers should cache this aggressively (e.g. in
 * localStorage) rather than re-running it on every page visit.
 */
export async function fetchPatronLeaderboard(): Promise<PatronLeaderboardRow[]> {
	if (!SUBGRAPH_URL) throw new Error('VITE_SUBGRAPH_URL is not set');

	const query = `{
		patrons(first: 1000) {
			id
			firstDepositTimestamp
			active
		}
		depositeds(first: 1000) {
			patron
			principalAdded
		}
		yieldAllocateds(first: 1000) {
			patron
			rethAmount
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

	const depositedByPatron = new Map<string, bigint>();
	for (const row of json.data.depositeds as { patron: string; principalAdded: string }[]) {
		const key = row.patron.toLowerCase();
		depositedByPatron.set(key, (depositedByPatron.get(key) ?? 0n) + BigInt(row.principalAdded));
	}

	const donatedByPatron = new Map<string, bigint>();
	for (const row of json.data.yieldAllocateds as { patron: string; rethAmount: string }[]) {
		const key = row.patron.toLowerCase();
		donatedByPatron.set(key, (donatedByPatron.get(key) ?? 0n) + BigInt(row.rethAmount));
	}

	return (json.data.patrons as { id: string; firstDepositTimestamp: string; active: boolean }[]).map((p) => {
		const key = p.id.toLowerCase();
		return {
			address: p.id,
			firstDepositTimestamp: Number(p.firstDepositTimestamp),
			active: p.active,
			totalDepositedEther: depositedByPatron.get(key) ?? 0n,
			totalDonatedReth: donatedByPatron.get(key) ?? 0n
		};
	});
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
