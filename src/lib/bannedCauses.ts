/**
 * Causes are permissionless — anyone can create one on-chain. "Curated"
 * occasionally a bad actor may appear inwhich case we need to remove this from
 * the UI
 */
const BANNED_CAUSE_IDS = new Set<number>([4]);

export function isCausedBanned(causeId: number | bigint | string): boolean {
	return BANNED_CAUSE_IDS.has(Number(causeId));
}
