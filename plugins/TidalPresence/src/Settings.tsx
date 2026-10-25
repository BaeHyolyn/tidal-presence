import { LunaSettings, LunaSwitchSetting, LunaTextSetting, LunaSelectSetting, LunaSelectItem } from "@luna/ui";

import { ReactiveStore } from "@luna/core";

import React from "react";
import { updateActivity } from "./presence";
import { getAvailablePipes } from "./getAvailablePipes.native";

export type SmallIcon = "artist" | "quality" | "none";

const defaultCustomStatusText = "{track} by {artist}";
const defaultCustomStateText = "{artist}";
const defaultCustomCoverText = "{album} · {quality}";

export const settings = await ReactiveStore.getPluginStorage("TidalPresence", {
	displayOnPause: true,
	// Legacy toggle, only read to migrate into smallIcon
	displayArtistIcon: true,
	// Left undefined so the migration below can decide it for existing users
	smallIcon: undefined as SmallIcon | undefined,
	displayPlaylistButton: true,
	displayAlbumButton: true,
	customStatusText: defaultCustomStatusText,
	customStateText: defaultCustomStateText,
	customCoverText: defaultCustomCoverText,
	pipeId: -1,
});

if (!settings.customStatusText || settings.customStatusText === "") settings.customStatusText = defaultCustomStatusText;
settings.customStateText ||= defaultCustomStateText;
settings.customCoverText ||= defaultCustomCoverText;
settings.displayAlbumButton ??= true;
settings.smallIcon ??= settings.displayArtistIcon === false ? "none" : "artist";
if (settings.pipeId === undefined) settings.pipeId = -1;

const tagList = (
	<ul>
		<li>{`{track}`}</li>
		<li>{`{artist}`}</li>
		<li>{`{album}`}</li>
		<li>{`{year}`}</li>
		<li>{`{duration}`}</li>
		<li>{`{trackNumber}`}</li>
		<li>{`{quality}`} (Max, HiFi, High, Low)</li>
		<li>{`{lyric}`} (live lyric line, when the song has synced lyrics)</li>
		<li>{`{playlist}`} (playlist, mix or album you're playing from)</li>
	</ul>
);

export const Settings = () => {
	const [displayOnPause, setDisplayOnPause] = React.useState(settings.displayOnPause);
	const [smallIcon, setSmallIcon] = React.useState(settings.smallIcon);
	const [displayPlaylistButton, setDisplayPlaylistButton] = React.useState(settings.displayPlaylistButton);
	const [customStatusText, setCustomStatusText] = React.useState(settings.customStatusText);
	const [customStateText, setCustomStateText] = React.useState(settings.customStateText);
	const [customCoverText, setCustomCoverText] = React.useState(settings.customCoverText);
	const [displayAlbumButton, setDisplayAlbumButton] = React.useState(settings.displayAlbumButton);

	const [pipeId, setPipeId] = React.useState(settings.pipeId);
	const [availablePipes, setAvailablePipes] = React.useState<number[]>([]);

	React.useEffect(() => {
		getAvailablePipes().then((pipes) => {
			setAvailablePipes(pipes);
			if (pipes.length > 0 && !pipes.includes(settings.pipeId)) {
				setPipeId((settings.pipeId = pipes[0]));
				updateActivity();
			}
		});
	}, []);

	return (
		<LunaSettings>
			{availablePipes.length > 1 && (
				<LunaSelectSetting
					title="Discord Instance (Pipe ID)"
					desc="Select which Discord instance to connect to."
					value={pipeId.toString()}
					onChange={(e) => {
						setPipeId((settings.pipeId = parseInt(e.target.value, 10)));
						updateActivity();
					}}
				>
					{availablePipes.map((pipe) => (
						<LunaSelectItem key={pipe} value={pipe.toString()}>
							Pipe {pipe}
						</LunaSelectItem>
					))}
				</LunaSelectSetting>
			)}
			<LunaSwitchSetting
				title="Display activity when paused"
				desc="If disabled, when paused discord wont show the activity"
				tooltip="Display activity"
				checked={displayOnPause}
				onChange={(_, checked) => {
					setDisplayOnPause((settings.displayOnPause = checked));
					updateActivity();
				}}
			/>
			<LunaSelectSetting
				title="Small icon"
				desc="The small icon on the corner of the album cover"
				value={smallIcon}
				onChange={(e) => {
					setSmallIcon((settings.smallIcon = e.target.value as SmallIcon));
					updateActivity();
				}}
			>
				<LunaSelectItem value="artist">Artist picture</LunaSelectItem>
				<LunaSelectItem value="quality">Audio quality badge (MAX, HIFI...)</LunaSelectItem>
				<LunaSelectItem value="none">None</LunaSelectItem>
			</LunaSelectSetting>
			<LunaSwitchSetting
				title="Display playlist button"
				desc="When playing a playlist a button appears for it in the activity"
				tooltip="Display playlist button"
				checked={displayPlaylistButton}
				onChange={(_, checked) => {
					setDisplayPlaylistButton((settings.displayPlaylistButton = checked));
					updateActivity();
				}}
			/>
			<LunaSwitchSetting
				title="Display album button"
				desc="Shows a button to the album (when the playlist button isn't shown)"
				tooltip="Display album button"
				checked={displayAlbumButton}
				onChange={(_, checked) => {
					setDisplayAlbumButton((settings.displayAlbumButton = checked));
					updateActivity();
				}}
			/>
			<LunaTextSetting
				title="Status text"
				desc={
					<>
						Customize the status text for Discord activity.
						<br />
						You can use the following tags:
						{tagList}
						Default: <b>{defaultCustomStatusText}</b>
					</>
				}
				value={customStatusText}
				onChange={(e) => {
					if (e.target.value === "" || !e.target.value) setCustomStatusText((settings.customStatusText = defaultCustomStatusText));
					else setCustomStatusText((settings.customStatusText = e.target.value));
					updateActivity();
				}}
			/>
			<LunaTextSetting
				title="Second line text"
				desc={
					<>
						Text shown below the track title. Same tags as above.
						<br />
						Default: <b>{defaultCustomStateText}</b>
					</>
				}
				value={customStateText}
				onChange={(e) => {
					setCustomStateText((settings.customStateText = e.target.value || defaultCustomStateText));
					updateActivity();
				}}
			/>
			<LunaTextSetting
				title="Album cover hover text"
				desc={
					<>
						Text shown when hovering the album cover. Same tags as above.
						<br />
						Default: <b>{defaultCustomCoverText}</b>
					</>
				}
				value={customCoverText}
				onChange={(e) => {
					setCustomCoverText((settings.customCoverText = e.target.value || defaultCustomCoverText));
					updateActivity();
				}}
			/>
			<p style={{ opacity: 0.6, fontSize: 12 }}>
				TidalPresence by BaeHyolyn · AGPL-3.0 · originally derived from DiscordRPC (Inrixia)
			</p>
		</LunaSettings>
	);
};
