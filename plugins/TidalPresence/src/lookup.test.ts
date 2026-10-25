import assert from "node:assert/strict";
import { createLookup } from "./lookup";

const tick = () => new Promise((r) => setTimeout(r, 0));

const main = async () => {
	// Found values are cached and trigger onLoaded once
	{
		let calls = 0;
		let loaded = 0;
		const get = createLookup(
			async (k: string) => (calls++, `v-${k}`),
			() => loaded++,
		);
		assert.equal(get("a"), undefined);
		assert.equal(get("a"), undefined, "no duplicate fetch while pending");
		await tick();
		assert.equal(get("a"), "v-a");
		assert.equal(calls, 1);
		assert.equal(loaded, 1);
	}

	// "Doesn't exist" is remembered and never fetched again
	{
		let calls = 0;
		const get = createLookup(
			async () => (calls++, undefined),
			() => {},
		);
		get("x");
		await tick();
		get("x");
		await tick();
		assert.equal(calls, 1);
	}

	// Failures are retried only after retryMs
	{
		let time = 0;
		let calls = 0;
		let fail = true;
		const get = createLookup(
			async () => {
				calls++;
				if (fail) throw new Error("network");
				return "ok";
			},
			() => {},
			{ retryMs: 1000, now: () => time },
		);
		get("k");
		await tick();
		assert.equal(get("k"), undefined);
		assert.equal(calls, 1, "no retry before retryMs");
		time = 1000;
		fail = false;
		get("k");
		await tick();
		assert.equal(calls, 2);
		assert.equal(get("k"), "ok");
	}

	// Oldest entries are evicted past maxEntries
	{
		let calls = 0;
		const get = createLookup(
			async (k: number) => (calls++, k),
			() => {},
			{ maxEntries: 2 },
		);
		for (const k of [1, 2, 3]) get(k);
		await tick();
		assert.equal(get(3), 3);
		assert.equal(get(1), undefined, "1 was evicted and is fetched again");
		assert.equal(calls, 4);
	}

	console.log("lookup: all tests passed");
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
