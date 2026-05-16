//! Save annotated screenshots produced by the React `<canvas>` overlay.
//!
//! The frontend composites bitmap + annotation strokes into a single PNG,
//! base64-encodes it, and posts it here. We run it through the chat image
//! pipeline so it lands in `pasted-images/` and gets resized/compressed like
//! any pasted image.

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::AppHandle;

#[tauri::command]
pub async fn browser_save_annotated_image(app: AppHandle, data: String) -> Result<String, String> {
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| format!("base64 decode: {e}"))?;

    let images_dir = crate::chat::storage::get_images_dir(&app)?;

    let path = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let (processed, ext) = crate::chat::process_image(&bytes, "png")?;
        let res = crate::chat::save_image_to_disk(&images_dir, &processed, &ext)?;
        Ok(res.path)
    })
    .await
    .map_err(|e| format!("save task panicked: {e}"))??;

    Ok(path)
}
