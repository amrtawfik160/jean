//! Open / close the native webview inspector (WKWebView Web Inspector on macOS,
//! Edge DevTools on Windows, WebKitGTK on Linux).
//!
//! Tauri's `open_devtools` / `close_devtools` are only compiled in debug builds
//! by default (`#[cfg(any(debug_assertions, feature = "devtools"))]`).
//! In release builds the commands are no-ops that return an error.

use tauri::{AppHandle, Manager};

use crate::browser::registry::get_label;

fn devtools_enabled() -> bool {
    cfg!(debug_assertions)
}

#[tauri::command]
pub async fn browser_open_devtools(app: AppHandle, tab_id: String) -> Result<(), String> {
    if !devtools_enabled() {
        return Err("DevTools are only available in debug builds".into());
    }
    let label = get_label(&tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;

    #[cfg(debug_assertions)]
    {
        webview.open_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = webview;
        Err("DevTools not compiled in".into())
    }
}

#[tauri::command]
pub async fn browser_close_devtools(app: AppHandle, tab_id: String) -> Result<(), String> {
    if !devtools_enabled() {
        return Ok(());
    }
    let label = get_label(&tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;

    #[cfg(debug_assertions)]
    {
        webview.close_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = webview;
        Ok(())
    }
}

#[tauri::command]
pub fn browser_devtools_available() -> bool {
    devtools_enabled()
}
