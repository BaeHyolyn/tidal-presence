import { PlayState, type MediaItem } from "@luna/lib";
import { createLookup } from "./lookup";
import { lineAt, parseLrc } from "./lrc";

// Discord accepts ~5 activity updates per 20s, so never refresh faster than this.
export const MIN_LYRIC_INTERVAL_MS = 5000;

// playTime only changes on play/pause/seek; currentTime is the live player position.
export const position = () => PlayState.currentTime || PlayState.playTime;

/** Returns a reader for the lyric line playing now. Lyrics are fetched from TIDAL once per track in the background. */
export const createLyrics = (onLoaded: () => void) => {
	const getLines = createLookup(
		(mediaItem: MediaItem) =>
			mediaItem.lyrics().then((lyrics) => {
				const lines = lyrics?.subtitles ? parseLrc(lyrics.subtitles) : [];
				return lines.length > 0 ? lines : undefined;
			}),
		onLoaded,
	);
	return (mediaItem: MediaItem) => {
		const lines = getLines(mediaItem);
		return lines ? lineAt(lines, position()) : { text: "", next: undefined };
	};
};
