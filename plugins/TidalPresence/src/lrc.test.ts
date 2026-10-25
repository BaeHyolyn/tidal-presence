import assert from "node:assert/strict";
import { lineAt, parseLrc } from "./lrc";

const lines = parseLrc("[00:12.50] First line\r\n[00:05.00] Intro\n[01:02.00]\nnot a lyric\n[01:10.25] Last");

assert.deepEqual(
	lines.map((l) => l.time),
	[5, 12.5, 62, 70.25],
);
assert.equal(lines[1].text, "First line");

assert.deepEqual(lineAt(lines, 0), { text: "", next: 5 });
assert.deepEqual(lineAt(lines, 5), { text: "Intro", next: 12.5 });
assert.deepEqual(lineAt(lines, 30), { text: "First line", next: 62 });
assert.deepEqual(lineAt(lines, 63), { text: "♪", next: 70.25 });
assert.deepEqual(lineAt(lines, 500), { text: "Last", next: undefined });
assert.deepEqual(lineAt([], 10), { text: "", next: undefined });

console.log("lrc: all tests passed");
