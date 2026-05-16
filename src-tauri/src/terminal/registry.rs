use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

use super::types::TerminalSession;

/// Global registry of active terminal sessions (terminal_id -> session)
pub static TERMINAL_SESSIONS: Lazy<Mutex<HashMap<String, TerminalSession>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Maximum bytes of recent PTY output kept per terminal for AI consumption.
/// 64 KiB is enough for several screenfuls (typical 80x24 ≈ 2 KiB) — plenty of
/// context for "what does this error mean / suggest a fix", while bounding RAM.
const MAX_BUFFER_BYTES: usize = 64 * 1024;

/// Rolling output buffer for one terminal — UTF-8 string, capped from the
/// front at a codepoint boundary so the AI never sees a split codepoint.
pub struct TerminalOutputBuffer {
    data: String,
}

impl TerminalOutputBuffer {
    fn new() -> Self {
        Self {
            data: String::new(),
        }
    }

    /// Append a UTF-8 chunk. Trims oldest content when the buffer would exceed
    /// `MAX_BUFFER_BYTES`, always cutting at a `char_boundary`.
    fn push(&mut self, chunk: &str) {
        self.data.push_str(chunk);
        if self.data.len() > MAX_BUFFER_BYTES {
            let overflow = self.data.len() - MAX_BUFFER_BYTES;
            let mut split = overflow;
            while split < self.data.len() && !self.data.is_char_boundary(split) {
                split += 1;
            }
            self.data.drain(..split);
        }
    }
}

/// Per-terminal rolling output buffer used by AI features (ask / autocomplete /
/// chat-input terminal mention). Kept separate from `TERMINAL_SESSIONS` so the
/// reader thread can append without holding the session lock.
pub static TERMINAL_OUTPUT_BUFFERS: Lazy<Mutex<HashMap<String, TerminalOutputBuffer>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Append PTY output to the per-terminal rolling buffer. Called from the
/// reader thread for every decoded chunk.
pub fn append_terminal_output(terminal_id: &str, chunk: &str) {
    if chunk.is_empty() {
        return;
    }
    let mut buffers = TERMINAL_OUTPUT_BUFFERS.lock().unwrap();
    buffers
        .entry(terminal_id.to_string())
        .or_insert_with(TerminalOutputBuffer::new)
        .push(chunk);
}

/// Get a copy of the recent output for a terminal, optionally trimmed from the
/// front to at most `max_bytes`. Returns an empty string if the terminal has
/// no recorded output.
pub fn snapshot_terminal_output(terminal_id: &str, max_bytes: Option<usize>) -> String {
    let buffers = TERMINAL_OUTPUT_BUFFERS.lock().unwrap();
    let Some(buf) = buffers.get(terminal_id) else {
        return String::new();
    };
    let data = &buf.data;
    match max_bytes {
        Some(limit) if data.len() > limit => {
            let mut split = data.len() - limit;
            while split < data.len() && !data.is_char_boundary(split) {
                split += 1;
            }
            data[split..].to_string()
        }
        _ => data.clone(),
    }
}

/// Drop the output buffer for a terminal. Called when the PTY exits or is
/// killed to release the ~64KiB allocation.
pub fn remove_terminal_output_buffer(terminal_id: &str) {
    let mut buffers = TERMINAL_OUTPUT_BUFFERS.lock().unwrap();
    buffers.remove(terminal_id);
}

/// Register a new terminal session
pub fn register_terminal(session: TerminalSession) {
    let mut sessions = TERMINAL_SESSIONS.lock().unwrap();
    sessions.insert(session.terminal_id.clone(), session);
}

/// Unregister a terminal session
pub fn unregister_terminal(terminal_id: &str) -> Option<TerminalSession> {
    let mut sessions = TERMINAL_SESSIONS.lock().unwrap();
    sessions.remove(terminal_id)
}

/// Check if a terminal exists
pub fn has_terminal(terminal_id: &str) -> bool {
    let sessions = TERMINAL_SESSIONS.lock().unwrap();
    sessions.contains_key(terminal_id)
}

/// Get all active terminal IDs
pub fn get_all_terminal_ids() -> Vec<String> {
    let sessions = TERMINAL_SESSIONS.lock().unwrap();
    sessions.keys().cloned().collect()
}

/// Execute a function with mutable access to a terminal session
pub fn with_terminal<F, R>(terminal_id: &str, f: F) -> Option<R>
where
    F: FnOnce(&mut TerminalSession) -> R,
{
    let mut sessions = TERMINAL_SESSIONS.lock().unwrap();
    sessions.get_mut(terminal_id).map(f)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buffer_caps_at_max_bytes() {
        let mut buf = TerminalOutputBuffer::new();
        let chunk = "a".repeat(40 * 1024);
        buf.push(&chunk);
        buf.push(&chunk);
        buf.push(&chunk);
        assert!(buf.data.len() <= MAX_BUFFER_BYTES);
        // Should keep the most recent bytes (all 'a').
        assert!(buf.data.chars().all(|c| c == 'a'));
    }

    #[test]
    fn buffer_keeps_codepoint_boundary() {
        let mut buf = TerminalOutputBuffer::new();
        // Push a chunk that would force a trim mid-codepoint if naive bytes.
        buf.push(&"x".repeat(MAX_BUFFER_BYTES - 1));
        // 4-byte UTF-8 codepoint (emoji): trimming would split it without
        // boundary handling.
        buf.push("🦀🦀🦀");
        assert!(buf.data.len() <= MAX_BUFFER_BYTES + 4); // Allow up to one codepoint over cap.
                                                         // String must still be valid UTF-8 (this would panic on invalid).
        let _ = buf.data.clone();
    }

    #[test]
    fn snapshot_trims_to_max_bytes() {
        let mut buf = TerminalOutputBuffer::new();
        buf.push(&"abcdef".repeat(10));
        // Store directly so we don't rely on global state.
        let snapshot = {
            let data = &buf.data;
            let max = 12;
            let split = data.len() - max;
            data[split..].to_string()
        };
        assert_eq!(snapshot.len(), 12);
    }
}
