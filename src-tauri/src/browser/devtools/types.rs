use serde::{Deserialize, Serialize};

/// Emitted by Rust → React when a screenshot finishes saving.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserScreenshotSavedEvent {
    pub tab_id: String,
    pub path: String,
    /// "visible" or "full-page" — drives toast wording + analytics
    pub origin: String,
}

/// Payload reported back when the page-injected inspector selects an element.
#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ElementSelection {
    pub tab_id: String,
    pub tag_name: String,
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub class_name: String,
    pub css_selector: String,
    pub outer_html: String,
    #[serde(default)]
    pub text_content: String,
    #[serde(default)]
    pub computed_styles: std::collections::HashMap<String, String>,
    pub bounding_rect: BoundingRect,
    #[serde(default)]
    pub page_url: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BoundingRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
