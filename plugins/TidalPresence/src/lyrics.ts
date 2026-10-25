import { PlayState, type MediaItem } from "@luna/lib";
import { lineAt, parseLrc, type Line } from "./lrc";

// Discord accepts ~5 activity updates per 20s, so never refresh faster than this.
export const MIN_LYRIC_INTERVAL_MS = 5000;

const cache = new Map<MediaItem["id"], Line[] | null>();

// Fetched from TIDAL once per track in the background; onLoaded refreshes the status.
const getLines = (mediaItem: MediaItem, onLoaded: () => void) => {
	if (cache.has(mediaItem.id)) return cache.get(mediaItem.id);
	cache.set(mediaItem.id, null);
	mediaItem
		.lyrics()
		.then((lyrics) => {
			const lines = lyrics?.subtitles ? parseLrc(lyrics.subtitles) : [];
			if (lines.length === 0) return;
			cache.set(mediaItem.id, lines);
			onLoaded();
		})
		.catch(() => {});
};

// playTime only changes on play/pause/seek; currentTime is the live player position.
export const position = () => PlayState.currentTime || PlayState.playTime;

export const currentLyric = (mediaItem: MediaItem, onLoaded: () => void) => {
	const lines = getLines(mediaItem, onLoaded);
	return lines ? lineAt(lines, position()) : { text: "", next: undefined };
};
