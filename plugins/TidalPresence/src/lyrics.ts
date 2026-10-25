import { PlayState, type MediaItem } from "@luna/lib";
import { createLookup } from "./lookup";
import { lyricAt, parseLrc } from "./lrc";

// playTime only changes on play/pause/seek; currentTime is the live player position.
export const position = () => PlayState.currentTime || PlayState.playTime;

/**
 * Returns a reader for the lyric line to show now. `leadMs` looks slightly ahead so a line
 * sent a bit early (to make up for Discord's delay) is already the upcoming one.
 * Lyrics are fetched from TIDAL once per track in the background.
 */
export const createLyrics = (onLoaded: () => void, leadMs: number) => {
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
		return lines ? lyricAt(lines, position(), leadMs) : { text: "", msUntilNext: undefined };
	};
};
