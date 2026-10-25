export type Line = { time: number; text: string };

/** Parses LRC subtitles ("[mm:ss.xx] text") into lines sorted by time (seconds). */
export const parseLrc = (lrc: string): Line[] =>
	lrc
		.split(/\r?\n/)
		.flatMap((raw) => {
			const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
			return m ? [{ time: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() }] : [];
		})
		.sort((a, b) => a.time - b.time);

/** The line playing at `time` (seconds) and when the next one starts. Empty lines are instrumental breaks. */
export const lineAt = (lines: Line[], time: number) => {
	let i = -1;
	while (i + 1 < lines.length && lines[i + 1].time <= time) i++;
	return { text: i >= 0 ? lines[i].text || "♪" : "", next: lines[i + 1]?.time as number | undefined };
};
