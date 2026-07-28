/**
 * Minimal typed localStorage cache with a TTL. Values round-trip through
 * JSON.stringify/parse with a custom replacer/reviver so bigint fields
 * survive — this app's on-chain and subgraph values are almost all bigint
 * wei amounts, which JSON can't serialize natively.
 */

type CacheEnvelope<T> = { value: T; cachedAt: number };

function replacer(_key: string, value: unknown): unknown {
	return typeof value === 'bigint' ? { __bigint: value.toString() } : value;
}

function reviver(_key: string, value: unknown): unknown {
	if (value && typeof value === 'object' && '__bigint' in (value as Record<string, unknown>)) {
		return BigInt((value as { __bigint: string }).__bigint);
	}
	return value;
}

/**
 * Reads a cached value if present and no older than maxAgeMs. Returns
 * undefined on a miss, an expired entry, corrupt JSON, or when localStorage
 * itself is unavailable (SSR, private browsing) — callers just treat that as
 * "go fetch it live", so this never needs to throw.
 */
export function readCache<T>(key: string, maxAgeMs: number): T | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		const entry = JSON.parse(raw, reviver) as CacheEnvelope<T>;
		if (Date.now() - entry.cachedAt > maxAgeMs) return undefined;
		return entry.value;
	} catch {
		return undefined;
	}
}

/**
 * When a cache entry was written (regardless of whether it's still within
 * its TTL) — for "last updated Xm ago" UI copy.
 */
export function cacheWrittenAt(key: string): number | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return undefined;
		return (JSON.parse(raw) as CacheEnvelope<unknown>).cachedAt;
	} catch {
		return undefined;
	}
}

export function writeCache<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const entry: CacheEnvelope<T> = { value, cachedAt: Date.now() };
		localStorage.setItem(key, JSON.stringify(entry, replacer));
	} catch {
		// Quota exceeded or blocked (private browsing) — caching is an
		// optimization, not a requirement, so just skip it silently.
	}
}
