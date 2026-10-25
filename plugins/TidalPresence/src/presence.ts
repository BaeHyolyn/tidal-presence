import { Artist, ContentBase, MediaItem, PlayState, redux } from "@luna/lib";
import type { SetActivity } from "@xhayper/discord-rpc";

import { setActivity, StatusDisplayTypeEnum } from "./discord.native";
import { errSignal, trace } from "./index";
import { settings } from "./Settings";
import { createLookup } from "./lookup";
import { createLyrics, MIN_LYRIC_INTERVAL_MS, position } from "./lyrics";
import { clamp, fill, getVars } from "./template";

// Proxy this so we dont try import a node native module
const StatusDisplayType = await StatusDisplayTypeEnum();

const DEBOUNCE_MS = 250;
const ASSETS = "https://raw.githubusercontent.com/BaeHyolyn/tidal-presence/main/assets";
const PAUSED_ICON = `${ASSETS}/paused.png`;
const qualityBadge = (quality: string) => (quality ? `${ASSETS}/quality-${quality.toLowerCase()}.png` : undefined);
const tidal = (path: string) => `https://tidal.com/${path}/u`;

// Tracks played from playlists carry a trimmed artist without a picture, so it's looked up in the background.
const lookupArtistPicture = createLookup(
	(id: redux.ItemId) => Artist.fromId(id).then((full) => full?.coverUrl("320")),
	() => updateActivity(),
);
const artistPicture = (artist: { id: redux.ItemId; picture?: string | null }) =>
	artist.picture ? ContentBase.formatCoverUrl(artist.picture, { res: "320" }) : lookupArtistPicture(artist.id);

const currentLyric = createLyrics(() => updateActivity());

let lyricTimer: ReturnType<typeof setTimeout> | undefined;
const usesLyrics = () => [settings.customStatusText, settings.customStateText, settings.customCoverText].some((t) => t?.includes("{lyric}"));

// Schedules the next refresh for when the next lyric line starts, throttled for Discord's rate limit.
const lyricFor = (mediaItem: MediaItem) => {
	clearTimeout(lyricTimer);
	if (!PlayState.playing || !usesLyrics()) return "";
	const { text, next } = currentLyric(mediaItem);
	if (next !== undefined) {
		const wait = Math.max((next - position()) * 1000, MIN_LYRIC_INTERVAL_MS);
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
	// Luna types tidalItem as a Track, but music videos come through here too
	const media = item as Readonly<redux.Track | redux.Video>;
	const isVideo = media.contentType === "video";

	const activity: SetActivity = {
		type: isVideo ? 3 : 2, // Watching : Listening
		statusDisplayType: StatusDisplayType.Name,
		name: fill(settings.customStatusText, vars),
		details: clamp(vars.track),
		detailsUrl: trackUrl,
		state: fill(settings.customStateText, vars),
		stateUrl: artistUrl,
		buttons: [{ label: isVideo ? "Watch on TIDAL" : "Listen on TIDAL", url: trackUrl }],
	};

	// Discord allows at most 2 buttons; playlist takes priority over album
	if (sourceEntityType === "playlist" && publicPlaylist && settings.displayPlaylistButton) {
		activity.buttons!.push({ label: "View Playlist", url: `https://tidal.com/browse${sourceUrl}` });
	} else if (albumUrl && settings.displayAlbumButton) {
		activity.buttons!.push({ label: "View Album", url: albumUrl });
	}

	const videoThumb =
		media.contentType === "video" && media.imageId
			? `https://resources.tidal.com/images/${media.imageId.split("-").join("/")}/480x320.jpg`
			: undefined;
	const cover = videoThumb ?? ContentBase.getAlbumCoverUrl(item.album);
	if (cover) {
		activity.largeImageKey = cover;
		activity.largeImageText = fill(settings.customCoverText, vars);
		activity.largeImageUrl = videoThumb ? trackUrl : albumUrl;
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
		if (settings.timeMode !== "none") {
			activity.startTimestamp = Date.now() - position() * 1000;
			// An end timestamp is what makes Discord draw the progress bar
			if (settings.timeMode === "bar" && item.duration) activity.endTimestamp = activity.startTimestamp + item.duration * 1000;
		}
	} else {
		activity.smallImageKey = PAUSED_ICON;
		activity.smallImageText = "Paused";
	}

	return activity;
};

const isHiddenArtist = (mediaItem: MediaItem) => {
	const hidden = settings.hiddenArtists
		.split(",")
		.map((name) => name.trim().toLowerCase())
		.filter(Boolean);
	if (hidden.length === 0) return false;
	const item = mediaItem.tidalItem;
	const artists = item.artists?.length ? item.artists : item.artist ? [item.artist] : [];
	return artists.some((a) => hidden.includes(a.name.toLowerCase()));
};

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;
let lastSent: string | undefined;

const push = async (mediaItem?: MediaItem) => {
	const visible = !settings.privateMode && (PlayState.playing || settings.displayOnPause);
	mediaItem ??= visible ? await MediaItem.fromPlaybackContext() : undefined;
	const activity = visible && mediaItem && !isHiddenArtist(mediaItem) ? buildActivity(mediaItem) : undefined;

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
