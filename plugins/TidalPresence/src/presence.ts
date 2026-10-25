import { Artist, ContentBase, MediaItem, PlayState, redux } from "@luna/lib";
import type { SetActivity } from "@xhayper/discord-rpc";

import { setActivity, StatusDisplayTypeEnum } from "./discord.native";
import { errSignal, trace } from "./index";
import { settings } from "./Settings";
import { currentLyric, MIN_LYRIC_INTERVAL_MS } from "./lyrics";
import { clamp, fill, getVars } from "./template";

// Proxy this so we dont try import a node native module
const StatusDisplayType = await StatusDisplayTypeEnum();

const DEBOUNCE_MS = 250;
const ASSETS = "https://raw.githubusercontent.com/BaeHyolyn/tidal-presence/main/assets";
const PAUSED_ICON = `${ASSETS}/paused.png`;
const qualityBadge = (quality: string) => (quality ? `${ASSETS}/quality-${quality.toLowerCase()}.png` : undefined);
const tidal = (path: string) => `https://tidal.com/${path}/u`;

// Tracks played from playlists carry a trimmed artist without a picture.
// Look it up once per artist in the background and refresh the status when it arrives.
const artistPictures = new Map<redux.ItemId, string | null>();
const artistPicture = (artist: { id: redux.ItemId; picture?: string | null }) => {
	if (artist.picture) return ContentBase.formatCoverUrl(artist.picture, { res: "320" });
	if (artistPictures.has(artist.id)) return artistPictures.get(artist.id) ?? undefined;
	artistPictures.set(artist.id, null);
	Artist.fromId(artist.id)
		.then((full) => {
			const url = full?.coverUrl("320");
			if (!url) return;
			artistPictures.set(artist.id, url);
			updateActivity();
		})
		.catch(() => {});
};

let lyricTimer: ReturnType<typeof setTimeout> | undefined;
const usesLyrics = () => [settings.customStatusText, settings.customStateText, settings.customCoverText].some((t) => t?.includes("{lyric}"));

// Schedules the next refresh for when the next lyric line starts, throttled for Discord's rate limit.
const lyricFor = (mediaItem: MediaItem) => {
	clearTimeout(lyricTimer);
	if (!PlayState.playing || !usesLyrics()) return "";
	const { text, next } = currentLyric(mediaItem, () => updateActivity());
	if (next !== undefined) {
		const wait = Math.max((next - PlayState.playTime) * 1000, MIN_LYRIC_INTERVAL_MS);
		lyricTimer = setTimeout(() => updateActivity(), wait);
	}
	return text;
};

export const buildActivity = (mediaItem: MediaItem): SetActivity => {
	const item = mediaItem.tidalItem;
	const vars = getVars(mediaItem, lyricFor(mediaItem));
	const { sourceUrl, sourceEntityId, sourceEntityType } = redux.store.getState().playQueue;
	const playlist = redux.store.getState().content?.playlists?.[sourceEntityId];
	const publicPlaylist = playlist?.publicPlaylist ?? playlist?.sharingLevel === "PUBLIC";

	const artist = item.artists?.[0] ?? item.artist;
	const artistUrl = artist ? tidal(`artist/${artist.id}`) : undefined;
	const albumUrl = item.album ? tidal(`album/${item.album.id}`) : undefined;
	const trackUrl = tidal(`${item.contentType}/${mediaItem.id}`);

	const activity: SetActivity = {
		type: 2, // Listening
		statusDisplayType: StatusDisplayType.Name,
		name: fill(settings.customStatusText, vars),
		details: clamp(vars.track),
		detailsUrl: trackUrl,
		state: fill(settings.customStateText, vars),
		stateUrl: artistUrl,
		buttons: [{ label: "Listen on TIDAL", url: trackUrl }],
	};

	// Discord allows at most 2 buttons; playlist takes priority over album
	if (sourceEntityType === "playlist" && publicPlaylist && settings.displayPlaylistButton) {
		activity.buttons!.push({ label: "View Playlist", url: `https://tidal.com/browse${sourceUrl}` });
	} else if (albumUrl && settings.displayAlbumButton) {
		activity.buttons!.push({ label: "View Album", url: albumUrl });
	}

	const cover = ContentBase.getAlbumCoverUrl(item.album);
	if (cover) {
		activity.largeImageKey = cover;
		activity.largeImageText = fill(settings.customCoverText, vars);
		activity.largeImageUrl = albumUrl;
	}

	if (PlayState.playing) {
		if (settings.smallIcon === "artist" && artist) {
			const picture = artistPicture(artist);
			if (picture) {
				activity.smallImageKey = picture;
				activity.smallImageText = clamp(artist.name);
				activity.smallImageUrl = artistUrl;
			}
		} else if (settings.smallIcon === "quality") {
			activity.smallImageKey = qualityBadge(vars.quality);
			activity.smallImageText = vars.quality ? `${vars.quality} quality` : undefined;
		}
		if (item.duration) {
			activity.startTimestamp = Date.now() - PlayState.playTime * 1000;
			activity.endTimestamp = activity.startTimestamp + item.duration * 1000;
		}
	} else {
		activity.smallImageKey = PAUSED_ICON;
		activity.smallImageText = "Paused";
	}

	return activity;
};

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;
let lastSent: string | undefined;

const push = async (mediaItem?: MediaItem) => {
	const visible = PlayState.playing || settings.displayOnPause;
	mediaItem ??= visible ? await MediaItem.fromPlaybackContext() : undefined;
	const activity = visible && mediaItem ? buildActivity(mediaItem) : undefined;

	// Timestamps shift by a few ms between calls, so compare at 1s precision
	const key = JSON.stringify([settings.pipeId, activity], (k, v) => (k.endsWith("Timestamp") ? Math.round(v / 1000) : v));
	if (key === lastSent) return;

	await setActivity(activity, settings.pipeId);
	lastSent = key;
};

/** Debounced: bursts of playback events collapse into a single Discord update. */
export const updateActivity = (mediaItem?: MediaItem) => {
	clearTimeout(timer);
	timer = setTimeout(async () => {
		await running;
		running = push(mediaItem)
			.then(() => (errSignal!._ = undefined))
			.catch((e) => {
				lastSent = undefined;
				trace.err.withContext("Failed to set activity")(e);
			});
	}, DEBOUNCE_MS);
};

export const stopPresence = () => {
	clearTimeout(timer);
	clearTimeout(lyricTimer);
};
