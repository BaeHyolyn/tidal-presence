import { MediaItem, PlayState, redux } from "@luna/lib";

import type { SetActivity } from "@xhayper/discord-rpc";
import { fillTemplate, fmtStr, getActivityVars, getStatusText } from "./activityTextHelpers";
import { setActivity, StatusDisplayTypeEnum } from "./discord.native";
import { settings } from "./Settings";
import { trace, errSignal } from "./index";

// Proxy this so we dont try import a node native module
const StatusDisplayType = await StatusDisplayTypeEnum();

// Debounce state
const DEBOUNCE_MS = 300;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isUpdating = false;
let pendingUpdate: MediaItem | undefined | null = null; // null = no pending, undefined = pending with no mediaItem

/**
 * Debounced wrapper for _updateActivity
 * - Waits DEBOUNCE_MS after last call before executing
 * - If already updating, queues the next update
 */
export const updateActivity = (mediaItem?: MediaItem) => {
	// If currently updating, mark that we need another update after
	if (isUpdating) {
		pendingUpdate = mediaItem;
		return;
	}

	// Clear existing timer
	if (debounceTimer) clearTimeout(debounceTimer);

	// Set new debounce timer
	debounceTimer = setTimeout(async () => {
		debounceTimer = null;
		await executeUpdate(mediaItem);
	}, DEBOUNCE_MS);
};

/**
 * Execute the actual update with mutex protection
 */
const executeUpdate = async (mediaItem?: MediaItem) => {
	isUpdating = true;
	try {
		await _updateActivity(mediaItem);
		errSignal!._ = undefined;
	} catch (e) {
		trace.err.withContext("Failed to set activity")(e);
	} finally {
		isUpdating = false;
		if (pendingUpdate !== null) {
			const pending = pendingUpdate;
			pendingUpdate = null;
			updateActivity(pending);
		}
	}
};

/**
 * Internal update implementation (no debounce/mutex)
 */
const _updateActivity = async (mediaItem?: MediaItem) => {
	if (!PlayState.playing && !settings.displayOnPause) return await setActivity(undefined, settings.pipeId);

	mediaItem ??= await MediaItem.fromPlaybackContext();
	if (mediaItem === undefined) return;

	const state = redux.store.getState();
	const { sourceUrl, sourceEntityId, sourceEntityType } = state.playQueue;
	const thisPlaylist = state?.content?.playlists[sourceEntityId] ?? [];
	const publicPlaylist = thisPlaylist?.publicPlaylist ?? thisPlaylist?.sharingLevel === "PUBLIC";

	const activity: SetActivity = { type: 2 }; // Listening type

	const trackUrl = `https://tidal.com/${mediaItem.tidalItem.contentType}/${mediaItem.id}/u`
	const trackSourceUrl = `https://tidal.com/browse${sourceUrl}`;

	const album = await mediaItem.album();
	const albumUrl = album ? `https://tidal.com/album/${album.id}/u` : undefined;

	activity.buttons = [
		{
			url: trackUrl,
			label: "Listen on TIDAL",
		},
	];

	// Discord allows at most 2 buttons; playlist takes priority over album
	if (sourceEntityType === "playlist" && publicPlaylist && settings.displayPlaylistButton) {
		activity.buttons.push({
			url: trackSourceUrl,
			label: "View Playlist",
		});
	} else if (albumUrl && settings.displayAlbumButton) {
		activity.buttons.push({
			url: albumUrl,
			label: "View Album",
		});
	}

	const artist = await mediaItem.artist();
	const artistUrl = `https://tidal.com/artist/${artist?.id}/u`;

	const vars = await getActivityVars(mediaItem);

	// Status text
	activity.name = getStatusText(vars);

	// Title
	const trackTitle = fmtStr(await mediaItem.title());
	activity.details = trackTitle;
	activity.detailsUrl = trackUrl;

	// Second line
	activity.state = fillTemplate(settings.customStateText || "{artist}", vars) ?? "Unknown Artist";
	activity.stateUrl = artistUrl;

	activity.details = trackTitle;
	activity.statusDisplayType = StatusDisplayType.Name;

	// Pause indicator
	if (PlayState.playing) {
		// Small Artist image
		if (settings.displayArtistIcon) {
			activity.smallImageKey = artist?.coverUrl("320");
			activity.smallImageText = fmtStr(artist?.name);
			activity.smallImageUrl = artistUrl;
		}

		// Playback/Time
		if (mediaItem.duration !== undefined) {
			activity.startTimestamp = Date.now() - PlayState.playTime * 1000;
			activity.endTimestamp = activity.startTimestamp + mediaItem.duration * 1000;
		}
	} else {
		activity.smallImageKey = "paused-icon";
		activity.smallImageText = "Paused";
		activity.endTimestamp = Date.now();
	}

	// Album
	if (album) {
		activity.largeImageKey = album.coverUrl();
		activity.largeImageText = fillTemplate(settings.customCoverText || "{album}", vars);
		activity.largeImageUrl = albumUrl;
	}

	await setActivity(activity, settings.pipeId);
};
