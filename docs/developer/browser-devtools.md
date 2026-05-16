# Embedded browser DevTools

The embedded browser ships with a second toolbar row (`BrowserDevToolsBar`) that
gives users Chrome-DevTools-style affordances:

- **Screenshot** (visible viewport / full-page) — auto-attached to chat
- **Element selector / inspector** — click any element, attach its HTML +
  selector + computed styles to chat input
- **Device emulation** — iPhone / iPad / Pixel / desktop presets and a
  user-defined Custom size
- **Native DevTools** — opens WKWebView / Edge DevTools (debug builds only)

## Architecture map

```
                       ┌─────────────────────────────────┐
                       │  BrowserView                    │
                       │  ├─ BrowserToolbar (URL/tabs)   │
                       │  ├─ BrowserDevToolsBar          │ ← new
                       │  ├─ ScreenshotAnnotateModal     │ ← new (overlay)
                       │  └─ BrowserTabContent           │
                       │      └─ device-frame wrapper    │ ← new
                       └─────────────────────────────────┘
                                       │
                  invoke()/listen()    │
                                       ▼
                       ┌─────────────────────────────────┐
                       │  src-tauri/src/browser/devtools/│
                       │    screenshot.rs    (capture)   │
                       │    inspector.rs     (DOM picker)│
                       │    native_devtools.rs           │
                       │    canvas.rs        (save PNG)  │
                       └─────────────────────────────────┘
```

## Screenshots

Two flavours: **visible viewport** and **full page**.

### Visible

`browser_capture_visible(tabId)` does a single platform-native region capture:

| Platform | Tool                                                  | Notes                                                       |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| macOS    | `/usr/sbin/screencapture -R x,y,w,h -t png`           | `-R` takes points (logical px); output PNG is at native res |
| Windows  | PowerShell + `System.Drawing.Bitmap.CopyFromScreen`   | No unsafe Win32 needed                                      |
| Linux    | `import` (ImageMagick) → `scrot` → `gnome-screenshot` | Best-effort fallback chain                                  |

The region is the webview's absolute screen position, computed as
`window.inner_position() + webview.position()` in `screenshot.rs::webview_screen_rect`.

### Full page (cooperative scroll-and-stitch)

`browser_capture_full_page(tabId)`:

1. Allocates a `CaptureSession` in a global map keyed by request id, including
   the screen rect and a `tokio::sync::oneshot` sender.
2. Injects an orchestrator script (`full_page_orchestrator`) that:
   - Saves `window.scrollY`
   - Loops `scrollTo(0, n * viewportHeight)` → wait two `requestAnimationFrame`
     - 120 ms settle → `invoke('browser_capture_chunk', …)`
   - Marks the final invocation with `isLast: true`
3. Each `browser_capture_chunk` calls the platform region-capture, pushes a
   `DynamicImage` into the session buffer. The last one removes the session
   and stitches with `image::imageops::overlay` (the `image` crate is already
   a dep — see `Cargo.toml`).
4. The completed PNG goes through `chat::process_image()` +
   `chat::save_image_to_disk()` so it lands in `pasted-images/` alongside
   anything else the user has pasted.

A 60 s timeout protects against a misbehaving page that never reaches
`isLast`. A 50-chunk safety cap keeps absurd `scrollHeight` values bounded.

### Why not WebKit's native screenshot API?

Tauri v2's `WebviewBuilder` does not expose `takeSnapshot` for child webviews,
and CDP is unavailable on WKWebView. Shelling out to OS capture tools is the
most reliable cross-platform path that respects WebKit's own rasterisation.

## Inspector

`browser_enter_inspect_mode(tabId)` injects an inline-styled overlay script
into the page (`inspector.rs::enter_script`):

- `mousemove` (capture-phase) → highlight `document.elementFromPoint()`
- `click` → invoke `browser_report_element_selection` with
  `{ tagName, cssSelector, outerHtml (truncated 4 KB), textContent,
computedStyles (curated subset), boundingRect, pageUrl }`
- `Escape` → cleanup + invoke `browser_inspector_cancelled`

Rust emits `browser:element-selected` to React. The
`useBrowserDevTools(worktreeId)` hook dispatches a `command:append-chat-input`
DOM event with a markdown `html element` code block; `ChatInput.tsx` listens
for that event, splices the block onto the live textarea value, and syncs the
Zustand draft.

The selector generator (`selectorFor`) prefers `#id` when available, else
walks up to 6 ancestors collecting `tag:nth-of-type(n)` segments.

## Device emulation

Built around a fixed list of presets in
`src/components/browser/device-presets.ts` plus a per-tab Custom override.

State lives in `browser-store`:

```ts
devicePresetByTab: Record<string, string>
customSizeByTab: Record<string, { width; height; dpr }>
```

`BrowserTabContent` reads the active preset and:

1. Wraps the placeholder div in a centered, fixed-size container with a
   subtle device-frame border when `preset !== responsive`.
2. Watches `effectiveUa` — when it changes, the underlying webview is closed
   and recreated with the new user agent, preserving the current URL via
   `browser_get_url`. (Tauri's `WebviewBuilder::user_agent()` is set-once,
   so swap = recreate.)

Limitations to surface to users:

- DPR / touch events / `matchMedia` are NOT spoofed — real device emulation
  requires CDP, which WKWebView does not expose.
- Switching presets reloads the tab (the toolbar makes this explicit).

## Annotation modal

`ScreenshotAnnotateModal.tsx` opens automatically when
`browser:screenshot-saved` fires:

- Loads the saved PNG into a bitmap canvas at natural resolution.
- Layers a transparent annotation canvas above it for `pen | rect | arrow | text`
  strokes (8-colour palette, 4 stroke widths, undo, clear).
- "Attach to chat" composites both canvases → `toBlob('image/png')` → base64 →
  `browser_save_annotated_image` → returns the saved path → pushed into the
  active session's `pendingImages` via `chat-store.addPendingImage`.

Cancel discards the in-memory strokes; the raw capture still lives in
`pasted-images/` for manual recovery.

## Native DevTools toggle

`browser_open_devtools(tabId)` / `browser_close_devtools(tabId)` wrap
`Webview::open_devtools()` / `close_devtools()`. Both are
`#[cfg(debug_assertions)]`-gated; release builds return an error / no-op.
`browser_devtools_available()` is what `BrowserDevToolsBar` queries at mount
to decide whether to render the button.

## Web-access (WebSocket dispatch)

Per the precedent at `src-tauri/src/lib.rs:3387`, the browser feature is
native-only — child webviews don't exist in the web-access transport. **None
of the devtools commands are registered in `http_server/dispatch.rs`.** If we
ever expose browser to web clients, we'd need to add the standard `dispatch.rs`
match arms (and figure out what "open a webview" means without a window).

## Adding a new preset

1. Append to `DEVICE_PRESETS` in `src/components/browser/device-presets.ts`
   with `{ id, label, width, height, dpr, userAgent, category }`.
2. No backend changes — UA is passed through `browser_create`'s
   `user_agent: Option<String>` parameter.
3. The icon in the dropdown is picked by `category` (phone/tablet/desktop).

## Adding a new annotation tool

1. Add the tool name to `AnnotationTool` in `src/types/browser.ts`.
2. Add a `ToolButton` in `ScreenshotAnnotateModal.tsx`.
3. Extend the `drawStroke()` switch with the rendering logic.
4. If the tool needs interactive geometry beyond a simple drag, extend
   `handlePointerDown` / `handlePointerMove`.
