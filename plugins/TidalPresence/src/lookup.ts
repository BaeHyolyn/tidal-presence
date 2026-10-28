/**
 * Synchronous view over an async lookup that Luna already caches (MediaItem.lyrics, Artist.fromId).
 * Returns the value once it has arrived, otherwise starts the lookup and returns undefined;
 * onLoaded() is called when a value arrives so the status can refresh.
 * A failed lookup is forgotten, so the next call asks again (Luna drops failed results too).
 */
export const createLookup = <K, T>(fetch: (key: K) => Promise<T | undefined>, onLoaded: () => void) => {
	// undefined = pending or nothing found; a key is only absent before its first call or after a failure
	const MAX_ENTRIES = 200;
	const known = new Map<K, { value?: T; request: object }>();

	const remember = (key: K, entry: { value?: T; request: object }) => {
		known.delete(key);
		known.set(key, entry);
		while (known.size > MAX_ENTRIES) known.delete(known.keys().next().value!);
	};

	return (key: K): T | undefined => {
		const cached = known.get(key);
		if (cached) {
			// Refresh recency so recently used tracks survive longer than old ones.
			remember(key, cached);
			return cached.value;
		}
		const entry = { request: {} } as { value?: T; request: object };
		remember(key, entry);
		fetch(key).then(
			(value) => {
				// An evicted or superseded request must not repopulate the cache.
				if (known.get(key) !== entry) return;
				entry.value = value;
				if (value !== undefined) onLoaded();
			},
			() => {
				if (known.get(key) === entry) known.delete(key);
			},
		);
		return undefined;
	};
};
