# AnimaEngine

A desktop overlay that plays GIF / APNG / WebP animations on top of everything on your screen,
inspired by MInteraDesktop / AnimaEngine.

## Run

```bash
npm install
npm start
```

## Features

- **Library**: 9 built-in pixel-art animations, plus your own files (`Add from PC` or drag & drop).
  Supports `.gif`, `.apng`, `.png`, `.webp`, `.jpg`.
- **Overlays**: transparent, always on top, visible on every desktop/Space and over full-screen apps.
  Launch as many as you like, including the same animation more than once.
- **Positioning**: drag an animation anywhere on screen, snap it to a corner/edge, or type exact X/Y
  coordinates in the **On screen** tab. Positions are saved and restored on next launch.
- **Per-animation options**: size, playback speed, opacity, mirror, crisp (pixel-art) scaling.
- **Click-through**: clicks pass through transparent pixels automatically. *Lock* makes the whole
  animation ignore the mouse; press `Cmd/Ctrl+Shift+U` to unlock everything.
- Right-click an animation on screen for quick options (size, move to, mirror, lock, close).

## Project layout

```
src/main/       Electron main process (windows, overlays, library, persistence)
src/preload/    IPC bridges for the main window and overlay windows
src/renderer/   Library / On screen / Settings UI
src/overlay/    Overlay player (WebCodecs ImageDecoder → canvas)
assets/gifs/    Built-in animations (generated)
scripts/        GIF encoder + pixel-art generator (`npm run generate-gifs`)
```

User data (imported files, settings, open overlays) lives in Electron's `userData` folder,
e.g. `~/Library/Application Support/AnimaEngine` on macOS.
