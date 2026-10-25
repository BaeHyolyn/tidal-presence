# TidalPresence

A customizable Discord Rich Presence plugin for [TidaLuna](https://github.com/Inrixia/TidaLuna). It shows what you're listening to on TIDAL in your Discord status, and you decide what that status says.

## Install

1. Install [TidaLuna](https://github.com/Inrixia/TidaLuna).
2. In TIDAL, open **Settings → Luna → Plugin Store**.
3. Paste this into **Install from URL**:

   ```
   https://github.com/BaeHyolyn/tidal-presence/releases/latest/download/store.json
   ```

4. Install **TidalPresence** from the store that appears.

If you already use the original **DiscordRPC** plugin, uninstall it first so Discord doesn't get two statuses.

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

## Privacy

TidalPresence talks to Discord through its local connection on your computer. It never reads your TIDAL login and sends nothing to any other server. Discord only sees track details that are already public.

## Build

```sh
pnpm install
pnpm run build
```

The plugin and `store.json` are written to `dist/`.

## Credits

TidalPresence is based on the [DiscordRPC](https://github.com/Inrixia/luna-plugins) plugin by [Inrixia](https://github.com/Inrixia), the author of TidaLuna. It was modified by [BaeHyolyn](https://github.com/BaeHyolyn).

## License

[AGPL-3.0](LICENSE), the same license as the original plugin.
