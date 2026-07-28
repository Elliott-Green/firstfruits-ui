// Wallets (e.g. MetaMask) return their own human-readable message nested inside
// ethers' wrapped error as `info.error.message`, prefixed with `ethers-<code>: `.
// Prefer that over ethers' outer message, which is a full stack-trace-style dump
// of the request (action, reason, info, code, version, ...).
export function getContractErrorMessage(e: unknown, fallback: string): string {
	if (e && typeof e === 'object') {
		const nested = (e as { info?: { error?: { message?: unknown } } }).info?.error?.message;
		if (typeof nested === 'string' && nested) {
			return nested.replace(/^ethers-[a-z-]+:\s*/, '');
		}
	}
	return e instanceof Error ? e.message : fallback;
}
