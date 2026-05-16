//! Element inspector: inject a hover-highlight + click-to-pick overlay into
//! the page. On click, the page invokes `browser_report_element_selection`
//! which emits `browser:element-selected` to React.

use serde_json::Value;
use tauri::{AppHandle, Manager};

use super::types::ElementSelection;
use crate::browser::registry::get_label;
use crate::http_server::EmitExt;

const INSPECTOR_FLAG: &str = "__jeanInspectorActive";

fn enter_script() -> String {
    // Self-contained inspector. Uses inline styles to avoid CSS conflicts with the host page.
    // Reports back via window.__TAURI_INTERNALS__.invoke('browser_report_element_selection', …).
    let flag = INSPECTOR_FLAG;
    format!(
        r#"(function() {{
  if (window.{flag}) return;
  window.{flag} = true;
  const overlay = document.createElement('div');
  overlay.id = '__jean_inspect_overlay';
  Object.assign(overlay.style, {{
    position: 'fixed', pointerEvents: 'none', zIndex: 2147483647,
    border: '2px solid #3b82f6', background: 'rgba(59, 130, 246, 0.18)',
    transition: 'all 60ms ease-out', boxSizing: 'border-box',
    left: '0px', top: '0px', width: '0px', height: '0px',
  }});
  const label = document.createElement('div');
  Object.assign(label.style, {{
    position: 'fixed', pointerEvents: 'none', zIndex: 2147483647,
    background: '#3b82f6', color: 'white', padding: '2px 6px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11px', borderRadius: '3px', whiteSpace: 'nowrap',
    left: '0px', top: '0px', maxWidth: '50vw', overflow: 'hidden',
    textOverflow: 'ellipsis',
  }});
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);
  let current = null;

  function targetAt(x, y) {{
    overlay.style.display = 'none';
    label.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    overlay.style.display = '';
    label.style.display = '';
    return el;
  }}

  function describe(el) {{
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      : '';
    return tag + id + cls;
  }}

  function selectorFor(el) {{
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {{
      let part = node.tagName.toLowerCase();
      const parent = node.parentNode;
      if (parent) {{
        const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (siblings.length > 1) {{
          part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
        }}
      }}
      parts.unshift(part);
      node = node.parentElement;
    }}
    return parts.join(' > ');
  }}

  function gatherStyles(el) {{
    const cs = window.getComputedStyle(el);
    const keep = [
      'display','position','width','height','margin','padding','color',
      'background-color','font-family','font-size','line-height','border',
      'flex-direction','justify-content','align-items','grid-template-columns',
      'z-index','opacity','transform','overflow',
    ];
    const out = {{}};
    for (const k of keep) {{
      const v = cs.getPropertyValue(k);
      if (v) out[k] = v;
    }}
    return out;
  }}

  function move(e) {{
    const el = targetAt(e.clientX, e.clientY);
    if (!el || el === overlay || el === label) return;
    current = el;
    const r = el.getBoundingClientRect();
    overlay.style.left = r.left + 'px';
    overlay.style.top = r.top + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
    label.textContent = describe(el);
    const labelTop = Math.max(0, r.top - 22);
    label.style.left = r.left + 'px';
    label.style.top = labelTop + 'px';
  }}

  function pick(e) {{
    e.preventDefault();
    e.stopPropagation();
    const el = current || targetAt(e.clientX, e.clientY);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const html = (el.outerHTML || '').slice(0, 4096);
    const text = (el.textContent || '').slice(0, 1024);
    const payload = {{
      tabId: window.__jeanInspectorTabId || '',
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      className: (el.className && typeof el.className === 'string') ? el.className : '',
      cssSelector: selectorFor(el),
      outerHtml: html,
      textContent: text,
      computedStyles: gatherStyles(el),
      boundingRect: {{ x: r.left, y: r.top, width: r.width, height: r.height }},
      pageUrl: window.location.href,
    }};
    cleanup();
    try {{ window.__TAURI_INTERNALS__.invoke('browser_report_element_selection', {{ payload }}); }} catch (_) {{}}
  }}

  function onKey(e) {{
    if (e.key === 'Escape') {{
      cleanup();
      try {{ window.__TAURI_INTERNALS__.invoke('browser_inspector_cancelled', {{ tabId: window.__jeanInspectorTabId || '' }}); }} catch (_) {{}}
    }}
  }}

  function cleanup() {{
    window.{flag} = false;
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('click', pick, true);
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    label.remove();
  }}

  document.addEventListener('mousemove', move, true);
  document.addEventListener('click', pick, true);
  document.addEventListener('keydown', onKey, true);
}})();"#
    )
}

fn exit_script() -> String {
    let flag = INSPECTOR_FLAG;
    format!(
        r#"(function() {{
            const overlay = document.getElementById('__jean_inspect_overlay');
            if (overlay) overlay.remove();
            window.{flag} = false;
        }})();"#
    )
}

fn set_tab_id_script(tab_id: &str) -> String {
    let escaped = tab_id.replace('\\', "\\\\").replace('\'', "\\'");
    format!("window.__jeanInspectorTabId = '{escaped}';")
}

#[tauri::command]
pub async fn browser_enter_inspect_mode(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = get_label(&tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;
    webview
        .eval(set_tab_id_script(&tab_id))
        .map_err(|e| e.to_string())?;
    webview.eval(enter_script()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_exit_inspect_mode(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = get_label(&tab_id).ok_or_else(|| format!("tab '{tab_id}' not found"))?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview '{label}' not found"))?;
    webview.eval(exit_script()).map_err(|e| e.to_string())
}

/// Called by the injected page script when the user clicks an element.
#[tauri::command]
pub async fn browser_report_element_selection(
    app: AppHandle,
    payload: Value,
) -> Result<(), String> {
    let mut selection: ElementSelection = serde_json::from_value(payload)
        .map_err(|e| format!("invalid element selection payload: {e}"))?;
    // tab_id may have been blank if window.__jeanInspectorTabId wasn't set —
    // accept it as-is; the React side knows the active tab.
    if selection.tab_id.is_empty() {
        log::debug!("element selection without tab_id");
    }
    // Trim absurdly large outerHTML defensively.
    if selection.outer_html.len() > 8192 {
        selection.outer_html.truncate(8192);
    }
    app.emit_all("browser:element-selected", &selection)
}

#[tauri::command]
pub async fn browser_inspector_cancelled(app: AppHandle, tab_id: String) -> Result<(), String> {
    app.emit_all(
        "browser:inspector-cancelled",
        &serde_json::json!({ "tabId": tab_id }),
    )
}
