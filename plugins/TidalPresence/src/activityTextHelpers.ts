import { MediaItem, PlayState, Quality } from "@luna/lib";
import { settings } from "./Settings";

const STR_MAX_LEN = 127;
export const fmtStr = (s?: string) => {
	if (!s) return;
	if (s.length < 2) s += " ";
	return s.length >= STR_MAX_LEN ? s.slice(0, STR_MAX_LEN - 3) + "..." : s;
};

const qualityNames = new Map<Quality, string>([
	[Quality.HiRes, "Max"],
	[Quality.MQA, "Master"],
	[Quality.High, "HiFi"],
	[Quality.Low, "High"],
	[Quality.Lowest, "Low"],
]);

const fmtDuration = (seconds?: number) => {
	if (seconds === undefined) return "";
	const s = Math.round(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const getQualityName = (mediaItem: MediaItem) => {
	const playing = Quality.fromAudioQuality(PlayState.playbackContext?.actualAudioQuality);
	return qualityNames.get(playing ?? mediaItem.bestQuality) ?? "";
};

export type ActivityVars = Record<"track" | "artist" | "album" | "year" | "duration" | "trackNumber" | "quality", string>;

export const getActivityVars = async (mediaItem: MediaItem): Promise<ActivityVars> => {
	const artistNames = (await MediaItem.artistNames(await mediaItem.artists())) ?? ["Unknown Artist"];
	return {
		track: (await mediaItem.title()) ?? "",
		artist: artistNames.join(", "),
		album: (await (await mediaItem.album())?.title()) ?? "",
		year: (await mediaItem.releaseDate())?.getFullYear().toString() ?? "",
		duration: fmtDuration(mediaItem.duration),
		trackNumber: mediaItem.trackNumber?.toString() ?? "",
		quality: getQualityName(mediaItem),
	};
};

export const fillTemplate = (template: string, vars: ActivityVars) =>
	fmtStr(template.replace(/\{(\w+)\}/g, (tag, key: string) => (key in vars ? vars[key as keyof ActivityVars] : tag)));

/** Returns the status line shown in Discord (Listening to ... etc.) */
export const getStatusText = (vars: ActivityVars) => fillTemplate(settings.customStatusText || "", vars);
