//! Screenshot capture for embedded browser tabs.
//!
//! - **Visible**: capture the current webview viewport via platform-native
//!   screen capture (macOS: `screencapture`, Windows: PowerShell+GDI, Linux:
//!   `gnome-screenshot`/`import`/`scrot`).
//! - **Full page**: cooperative scroll-and-stitch. An injected orchestrator
//!   script in the page scrolls one viewport at a time and asks Rust to capture
//!   each chunk via `browser_capture_chunk`. The final invocation triggers
//!   stitching with the `image` crate and resolves the original `Promise`.
//!
//! Saved images flow through the same `process_image()` + `save_image_to_disk()`
//! pipeline used for chat paste/drop, so they end up in `pasted-images/` with a
//! UUID filename and get JPEG-compressed when opaque.

use image::{DynamicImage, RgbaImage};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;
use uuid::Uuid;

use super::types::BrowserScreenshotSavedEvent;
use crate::browser::registry::get_label;
use crate::http_server::EmitExt;
use crate::platform::silent_command;

const CAPTURE_TIMEOUT: Duration = Duration::from_secs(60);

/// Physical pixel rectangle on the OS screen.
#[derive(Clone, Copy, Debug)]
struct ScreenRect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f64,
}

/// Compute the webview's position in absolute physical screen coordinates.
///
/// `webview.position()` is relative to the window's content area, so we add
/// the window's `inner_position()` (which is the screen-pixel top-left of the
/// content area, *not* the frame).
fn webview_screen_rect(app: &AppHandle, tab_id: &str) -> Result<ScreenRect, String> {
    let label = get_label(tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;
    let window = webview.window();

    let win_inner = window
        .inner_position()
        .map_err(|e| format!("inner_position failed: {e}"))?;
    let wv_pos = webview
        .position()
        .map_err(|e| format!("position failed: {e}"))?;
    let wv_size = webview.size().map_err(|e| format!("size failed: {e}"))?;
    let scale = window
        .scale_factor()
        .map_err(|e| format!("scale_factor failed: {e}"))?;

    Ok(ScreenRect {
        x: win_inner.x + wv_pos.x,
        y: win_inner.y + wv_pos.y,
        width: wv_size.width.max(1),
        height: wv_size.height.max(1),
        scale,
    })
}

/// Capture a rectangular region of the screen as a `DynamicImage`.
fn capture_region(rect: ScreenRect) -> Result<DynamicImage, String> {
    let tmp = std::env::temp_dir().join(format!("jean-shot-{}.png", Uuid::new_v4()));
    capture_region_to_file(rect, &tmp)?;
    let bytes = std::fs::read(&tmp).map_err(|e| format!("read capture: {e}"))?;
    let _ = std::fs::remove_file(&tmp);
    image::load_from_memory(&bytes).map_err(|e| format!("decode capture: {e}"))
}

#[cfg(target_os = "macos")]
fn capture_region_to_file(rect: ScreenRect, out: &std::path::Path) -> Result<(), String> {
    // screencapture uses points (logical pixels) for -R; output PNG is at native res.
    let lx = (rect.x as f64 / rect.scale).round() as i32;
    let ly = (rect.y as f64 / rect.scale).round() as i32;
    let lw = (rect.width as f64 / rect.scale).round().max(1.0) as i32;
    let lh = (rect.height as f64 / rect.scale).round().max(1.0) as i32;
    let region = format!("{lx},{ly},{lw},{lh}");
    let status = silent_command("/usr/sbin/screencapture")
        .args([
            "-x",
            "-R",
            &region,
            "-t",
            "png",
            out.to_string_lossy().as_ref(),
        ])
        .status()
        .map_err(|e| format!("spawn screencapture: {e}"))?;
    if !status.success() {
        return Err(format!("screencapture failed (status {status})"));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn capture_region_to_file(rect: ScreenRect, out: &std::path::Path) -> Result<(), String> {
    // PowerShell GDI capture — keeps zero unsafe Win32 in this crate.
    let script = format!(
        r#"Add-Type -AssemblyName System.Drawing;
$bmp = New-Object System.Drawing.Bitmap({w},{h});
$g = [System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen({x},{y},0,0,(New-Object System.Drawing.Size({w},{h})));
$bmp.Save('{path}', [System.Drawing.Imaging.ImageFormat]::Png);
$g.Dispose(); $bmp.Dispose();"#,
        x = rect.x,
        y = rect.y,
        w = rect.width,
        h = rect.height,
        path = out.to_string_lossy().replace('\'', "''"),
    );
    let status = silent_command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .map_err(|e| format!("spawn powershell: {e}"))?;
    if !status.success() {
        return Err(format!("powershell capture failed (status {status})"));
    }
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn capture_region_to_file(rect: ScreenRect, out: &std::path::Path) -> Result<(), String> {
    // gnome-screenshot doesn't take a region directly; fall back to `import` (ImageMagick)
    // which does, then to `scrot -a`.
    let geom = format!("{}x{}+{}+{}", rect.width, rect.height, rect.x, rect.y);
    let out_str = out.to_string_lossy().to_string();

    let candidates: &[(&str, Vec<String>)] = &[
        (
            "import",
            vec![
                "-window".into(),
                "root".into(),
                "-crop".into(),
                geom.clone(),
                out_str.clone(),
            ],
        ),
        (
            "scrot",
            vec![
                "-a".into(),
                format!("{},{},{},{}", rect.x, rect.y, rect.width, rect.height),
                out_str.clone(),
            ],
        ),
        (
            "gnome-screenshot",
            vec!["-a".into(), "-f".into(), out_str.clone()],
        ),
    ];

    for (program, args) in candidates {
        let exists = which::which(program).is_ok();
        if !exists {
            continue;
        }
        let status = silent_command(program)
            .args(args)
            .status()
            .map_err(|e| format!("spawn {program}: {e}"))?;
        if status.success() && out.exists() {
            return Ok(());
        }
    }
    Err("No screen-capture tool found (install ImageMagick, scrot, or gnome-screenshot)".into())
}

/// Save a `DynamicImage` through the chat pipeline → `pasted-images/`.
fn save_dynamic_image(app: &AppHandle, img: DynamicImage) -> Result<String, String> {
    let mut buf = std::io::Cursor::new(Vec::<u8>::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| format!("encode png: {e}"))?;
    let bytes = buf.into_inner();

    let images_dir = crate::chat::storage::get_images_dir(app)?;
    let (processed, ext) = crate::chat::process_image(&bytes, "png")?;
    let res = crate::chat::save_image_to_disk(&images_dir, &processed, &ext)?;
    Ok(res.path)
}

/// Capture the visible viewport for `tab_id`, save it, and emit the
/// `browser:screenshot-saved` event so the React side can open the
/// annotation modal.
#[tauri::command]
pub async fn browser_capture_visible(app: AppHandle, tab_id: String) -> Result<String, String> {
    let rect = webview_screen_rect(&app, &tab_id)?;
    let app_for_blocking = app.clone();
    let path = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let img = capture_region(rect)?;
        save_dynamic_image(&app_for_blocking, img)
    })
    .await
    .map_err(|e| format!("capture task panicked: {e}"))??;

    let _ = app.emit_all(
        "browser:screenshot-saved",
        &BrowserScreenshotSavedEvent {
            tab_id: tab_id.clone(),
            path: path.clone(),
            origin: "visible".into(),
        },
    );
    Ok(path)
}

// ────────────────────────────────────────────────────────────────────────────
//  Full-page capture: cooperative scroll-and-stitch
// ────────────────────────────────────────────────────────────────────────────

struct CaptureSession {
    tab_id: String,
    rect: ScreenRect,
    chunks: Vec<DynamicImage>,
    /// Total scroll height of the page in CSS px.
    total_css_height: f64,
    /// Single viewport height in CSS px (used to crop the final chunk).
    viewport_css_height: f64,
    /// Original scroll position to restore on completion.
    original_scroll_y: f64,
    sender: Option<oneshot::Sender<Result<String, String>>>,
}

static CAPTURE_SESSIONS: Lazy<Mutex<HashMap<String, CaptureSession>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Build the orchestrator script. The page scrolls one viewport at a time,
/// invokes `browser_capture_chunk` after each settle, and signals completion
/// on the last step.
fn full_page_orchestrator(req_id: &str) -> String {
    let escaped = req_id.replace('\\', "\\\\").replace('\'', "\\'");
    format!(
        r#"(async function() {{
            const reqId = '{escaped}';
            const internals = window.__TAURI_INTERNALS__;
            if (!internals || !internals.invoke) return;
            const doc = document.documentElement;
            const originalScrollY = window.scrollY;
            const viewportHeight = window.innerHeight;
            const totalHeight = Math.max(doc.scrollHeight, doc.offsetHeight, viewportHeight);
            const wait = (ms) => new Promise(r => setTimeout(r, ms));
            const settle = async () => {{
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                await wait(120);
            }};
            try {{
                let scrollY = 0;
                let idx = 0;
                // Cap to a sane number of chunks so a misbehaving page doesn't
                // loop forever. 50 viewports ≈ 40k CSS px of content.
                const MAX_CHUNKS = 50;
                while (true) {{
                    window.scrollTo(0, scrollY);
                    await settle();
                    const isLast = (scrollY + viewportHeight >= totalHeight) || idx >= MAX_CHUNKS - 1;
                    await internals.invoke('browser_capture_chunk', {{
                        reqId,
                        scrollY: window.scrollY,
                        totalHeight,
                        viewportHeight,
                        isLast,
                    }});
                    if (isLast) break;
                    scrollY += viewportHeight;
                    idx++;
                }}
            }} catch (e) {{
                try {{ await internals.invoke('browser_capture_abort', {{ reqId, message: String(e) }}); }} catch (_) {{}}
            }} finally {{
                window.scrollTo(0, originalScrollY);
            }}
        }})();"#
    )
}

#[tauri::command]
pub async fn browser_capture_full_page(app: AppHandle, tab_id: String) -> Result<String, String> {
    let rect = webview_screen_rect(&app, &tab_id)?;
    let label = get_label(&tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;

    let req_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();

    {
        let mut sessions = CAPTURE_SESSIONS.lock().unwrap();
        sessions.insert(
            req_id.clone(),
            CaptureSession {
                tab_id: tab_id.clone(),
                rect,
                chunks: Vec::new(),
                total_css_height: 0.0,
                viewport_css_height: 0.0,
                original_scroll_y: 0.0,
                sender: Some(tx),
            },
        );
    }

    let script = full_page_orchestrator(&req_id);
    webview
        .eval(script)
        .map_err(|e| format!("inject orchestrator: {e}"))?;

    let result = tokio::time::timeout(CAPTURE_TIMEOUT, rx)
        .await
        .map_err(|_| {
            // Clean up if the orchestrator never finished.
            CAPTURE_SESSIONS.lock().unwrap().remove(&req_id);
            "Full-page capture timed out".to_string()
        })?
        .map_err(|e| format!("capture session dropped: {e}"))?;

    let path = result?;
    let _ = app.emit_all(
        "browser:screenshot-saved",
        &BrowserScreenshotSavedEvent {
            tab_id,
            path: path.clone(),
            origin: "full-page".into(),
        },
    );
    Ok(path)
}

#[tauri::command]
pub async fn browser_capture_chunk(
    app: AppHandle,
    req_id: String,
    scroll_y: f64,
    total_height: f64,
    viewport_height: f64,
    is_last: bool,
) -> Result<(), String> {
    let (rect, _tab_id) = {
        let mut sessions = CAPTURE_SESSIONS.lock().unwrap();
        let session = sessions
            .get_mut(&req_id)
            .ok_or_else(|| format!("capture session '{req_id}' not found"))?;
        if session.viewport_css_height == 0.0 {
            session.viewport_css_height = viewport_height;
            session.total_css_height = total_height;
            session.original_scroll_y = scroll_y;
        }
        (session.rect, session.tab_id.clone())
    };

    // Run capture off-thread.
    let img = tokio::task::spawn_blocking(move || capture_region(rect))
        .await
        .map_err(|e| format!("capture task panicked: {e}"))??;

    let maybe_finish = {
        let mut sessions = CAPTURE_SESSIONS.lock().unwrap();
        let session = sessions
            .get_mut(&req_id)
            .ok_or_else(|| format!("capture session '{req_id}' vanished"))?;
        session.chunks.push(img);

        if is_last {
            sessions.remove(&req_id)
        } else {
            None
        }
    };

    if let Some(mut session) = maybe_finish {
        let app_blocking = app.clone();
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let stitched = stitch_chunks(
                &session.chunks,
                session.rect.scale,
                session.viewport_css_height,
                session.total_css_height,
            )?;
            save_dynamic_image(&app_blocking, stitched)
        })
        .await
        .map_err(|e| format!("stitch task panicked: {e}"))?;

        if let Some(tx) = session.sender.take() {
            let _ = tx.send(result);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn browser_capture_abort(req_id: String, message: String) -> Result<(), String> {
    let session = CAPTURE_SESSIONS.lock().unwrap().remove(&req_id);
    if let Some(mut s) = session {
        if let Some(tx) = s.sender.take() {
            let _ = tx.send(Err(format!("capture aborted: {message}")));
        }
    }
    Ok(())
}

/// Stitch viewport-sized chunks into one tall image, cropping the trailing
/// duplicate produced by the final scroll position clamping at the bottom.
fn stitch_chunks(
    chunks: &[DynamicImage],
    scale: f64,
    viewport_css_height: f64,
    total_css_height: f64,
) -> Result<DynamicImage, String> {
    if chunks.is_empty() {
        return Err("no chunks captured".into());
    }
    let first = &chunks[0];
    let width = first.width();
    let chunk_height = first.height();

    let total_px_height = (total_css_height * scale).round().max(1.0) as u32;
    // Cap at sum of chunk heights so we never allocate beyond what we have.
    let max_possible = chunk_height.saturating_mul(chunks.len() as u32);
    let out_height = total_px_height.min(max_possible);

    let mut canvas = RgbaImage::new(width, out_height);

    let viewport_px = (viewport_css_height * scale).round().max(1.0) as u32;

    for (idx, chunk) in chunks.iter().enumerate() {
        let dst_y = (idx as u32) * viewport_px;
        if dst_y >= out_height {
            break;
        }
        // Final chunk may overlap the previous one (page reached scroll bottom
        // and clamped). Only copy the rows that haven't been drawn yet.
        let rows_remaining = out_height - dst_y;
        let copy_rows = chunk.height().min(rows_remaining);
        let src_top = chunk.height() - copy_rows;
        let cropped = chunk.crop_imm(0, src_top, width, copy_rows);
        let rgba = cropped.to_rgba8();
        // image::imageops::overlay handles RGBA → RGBA paste at coords.
        image::imageops::overlay(&mut canvas, &rgba, 0_i64, dst_y as i64);
    }

    Ok(DynamicImage::ImageRgba8(canvas))
}
