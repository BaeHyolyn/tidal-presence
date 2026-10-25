<p align="center">
  <img src="assets/icon.png" width="160" alt="TidalPresence logo" />
</p>

<h1 align="center">TidalPresence</h1>

<p align="center">Your TIDAL music in Discord, your way.</p>

TidalPresence is a Discord Rich Presence plugin for [TidaLuna](https://github.com/Inrixia/TidaLuna). It shows what you're listening to on TIDAL in your Discord status, and you decide exactly what that status says.

## Install

1. Install [TidaLuna](https://github.com/Inrixia/TidaLuna).
2. In TIDAL, open **Settings → Luna → Plugin Store**.
3. Paste this into **Install from URL**:

   ```
   https://github.com/BaeHyolyn/tidal-presence/releases/latest/download/store.json
   ```

4. Install **TidalPresence** from the store that appears.

If you use another Discord status plugin, disable it first so Discord doesn't get two statuses.

When TidalPresence loads, Luna asks for file system access. The plugin needs it to find Discord's local connection, so allow it.

## Features

- **Custom text** for the status line, the line under the track title, and the album cover hover text.
- **Tags** you can use in any of those texts:

  | Tag | Example |
  |---|---|
  | `{track}` | Bohemian Rhapsody |
  | `{artist}` | Queen |
  | `{album}` | A Night at the Opera |
  | `{year}` | 1975 |
  | `{duration}` | 5:55 |
  | `{trackNumber}` | 11 |
  | `{quality}` | Max, HiFi, High or Low (what's actually playing) |

- **Buttons**: "Listen on TIDAL", plus "View Album", or "View Playlist" when you're playing a public playlist.
- Optional artist icon, and you choose whether the status stays visible while paused.

Example status text: `{track} by {artist} · {album} on TIDAL`

## Fast and private

- **Instant updates.** Your status is built from data TIDAL already has loaded, so it appears right away. The only lookup is the artist picture when TIDAL didn't load it (for example, songs played from a playlist): it's fetched once per artist from TIDAL in the background and remembered.
- **No duplicate updates.** Identical updates are skipped, and quick bursts of events like seeking are merged into a single update.
- **Reconnects automatically** if Discord is closed or restarted.
- **Nothing leaves your PC except to Discord.** The plugin talks to Discord through its local connection, never reads your TIDAL login, and sends nothing to any other server.

## Build

```sh
pnpm install
pnpm run build
```

The plugin and `store.json` are written to `dist/`.

## License

[AGPL-3.0](LICENSE). Created by [BaeHyolyn](https://github.com/BaeHyolyn). Originally derived from DiscordRPC by Inrixia.
