type Entry<T> = { value?: T; pending?: boolean; retryAt?: number };

export type LookupOptions = { retryMs?: number; maxEntries?: number; now?: () => number };

/**
 * Background lookup cache. Returns the value if known, otherwise starts a fetch and returns undefined.
 * - resolved value: cached, onLoaded() is called so the caller can refresh
 * - resolved undefined: the thing doesn't exist (e.g. no lyrics), never asked again
 * - rejected: a temporary failure, asked again on the first call after retryMs
 */
export const createLookup = <K, T>(fetch: (key: K) => Promise<T | undefined>, onLoaded: () => void, opts: LookupOptions = {}) => {
	const { retryMs = 60_000, maxEntries = 200, now = Date.now } = opts;
	const cache = new Map<K, Entry<T>>();

	const set = (key: K, entry: Entry<T>) => {
		cache.delete(key);
		cache.set(key, entry);
		// Maps keep insertion order, so the first key is the oldest
		if (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
	};

	return (key: K): T | undefined => {
		const entry = cache.get(key);
		if (entry?.value !== undefined) return entry.value;
		if (entry && (entry.pending || entry.retryAt === undefined || now() < entry.retryAt)) return undefined;

		set(key, { pending: true });
		fetch(key).then(
			(value) => {
				set(key, value === undefined ? {} : { value });
				if (value !== undefined) onLoaded();
			},
			() => set(key, { retryAt: now() + retryMs }),
		);
		return undefined;
	};
};
