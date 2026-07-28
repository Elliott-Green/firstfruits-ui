/**
 * Causes are permissionless — anyone can create one on-chain. "Curated"
 * isn't a contract concept; it's us vouching that a specific cause's owner
 * is someone we know and trust. There's no backend for this yet, so it's
 * just a maintained list of cause IDs, looked up by ID wherever we display
 * a cause (marquee, causes list, etc.).
 */
const CURATED_CAUSE_IDS = new Set<number>([1, 2]);

export function isCauseCurated(causeId: number | bigint | string): boolean {
	return CURATED_CAUSE_IDS.has(Number(causeId));
}
