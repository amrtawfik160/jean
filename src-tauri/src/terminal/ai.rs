//! Terminal AI commands: answer free-form questions and auto-complete shell
//! commands using the user's configured chat backend (Claude / Codex / OpenCode
//! / Cursor). All commands are one-shot calls that include the recent terminal
//! output as grounding context.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::AppHandle;

use super::registry::snapshot_terminal_output;
use crate::chat::types::Backend;
use crate::claude_cli::resolve_cli_binary;
use crate::platform::silent_command;

/// Maximum bytes of terminal output passed to the AI. Bigger contexts spend
/// tokens fast without proportionally improving relevance — the last few
/// thousand bytes are almost always what the user is asking about.
const MAX_AI_BUFFER_BYTES: usize = 16 * 1024;

/// JSON schema for `ask_terminal_ai` responses.
const ASK_TERMINAL_SCHEMA: &str = r#"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "answer": {
      "type": "string",
      "description": "Brief, terminal-friendly answer to the user's question, grounded in the recent terminal output. 1-3 short paragraphs at most. No markdown headings."
    },
    "command": {
      "type": ["string", "null"],
      "description": "Optional single-line shell command the user could run next. Plain text only — no markdown code fences, no leading $, no trailing semicolons. Null when no command is appropriate."
    }
  },
  "required": ["answer", "command"]
}"#;

/// JSON schema for `suggest_terminal_command` responses.
const SUGGEST_COMMAND_SCHEMA: &str = r#"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "command": {
      "type": "string",
      "description": "A complete, useful, single-line shell command the user likely wants to run next. Replace the user's partial input — do not echo it back. No markdown, no leading $, no trailing newline."
    },
    "explanation": {
      "type": "string",
      "description": "One short sentence explaining what the command does. Plain text."
    }
  },
  "required": ["command", "explanation"]
}"#;

/// Response payload for `ask_terminal_ai`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskTerminalResponse {
    pub answer: String,
    #[serde(default)]
    pub command: Option<String>,
}

/// Response payload for `suggest_terminal_command`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestCommandResponse {
    pub command: String,
    #[serde(default)]
    pub explanation: String,
}

/// Strip ANSI/VT escape sequences. Terminal output is full of cursor moves and
/// SGR colour codes that are pure noise to the AI — and waste tokens. We keep
/// printable characters, newlines, and tabs.
fn strip_ansi(input: &str) -> String {
    static ANSI: Lazy<Regex> = Lazy::new(|| {
        // CSI: ESC [ ... final-byte
        // OSC: ESC ] ... BEL or ST
        // Two-byte/charset selectors: ESC ( B etc.
        // Other single-char ESC sequences.
        Regex::new(
            r"\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)|\x1B[PX^_][^\x1B]*\x1B\\|\x1B[()][AB012]|\x1B[=>NOM78cDHEZ]",
        )
        .expect("ANSI regex compiles")
    });
    let cleaned = ANSI.replace_all(input, "");
    // Also drop solitary control bytes (excluding \n \t).
    cleaned
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect()
}

/// Get a recent slice of terminal output. Public so the frontend can fetch the
/// raw buffer and decide whether to render or send to the chat (e.g. when
/// mentioning a terminal in the chat composer).
#[tauri::command]
pub async fn get_terminal_buffer(
    terminal_id: String,
    max_bytes: Option<usize>,
    strip_ansi_codes: Option<bool>,
) -> Result<String, String> {
    let limit = max_bytes.unwrap_or(MAX_AI_BUFFER_BYTES);
    let raw = snapshot_terminal_output(&terminal_id, Some(limit));
    if strip_ansi_codes.unwrap_or(true) {
        Ok(strip_ansi(&raw))
    } else {
        Ok(raw)
    }
}

/// Ask the AI a question with the recent terminal output as context.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn ask_terminal_ai(
    app: AppHandle,
    terminal_id: String,
    question: String,
    worktree_path: Option<String>,
    worktree_id: Option<String>,
    backend: Option<String>,
    model: Option<String>,
    reasoning_effort: Option<String>,
    custom_profile_name: Option<String>,
) -> Result<AskTerminalResponse, String> {
    let trimmed_q = question.trim();
    if trimmed_q.is_empty() {
        return Err("Question is empty".to_string());
    }

    let buffer = strip_ansi(&snapshot_terminal_output(
        &terminal_id,
        Some(MAX_AI_BUFFER_BYTES),
    ));

    let prompt = build_ask_prompt(trimmed_q, &buffer);
    let working_dir = worktree_path.as_deref().map(Path::new);

    let backend_choice =
        crate::chat::resolve_magic_prompt_backend(&app, backend.as_deref(), worktree_id.as_deref());

    let json_str = execute_one_shot(
        &app,
        backend_choice,
        &prompt,
        ASK_TERMINAL_SCHEMA,
        model.as_deref(),
        working_dir,
        reasoning_effort.as_deref(),
        custom_profile_name.as_deref(),
    )?;

    parse_response::<AskTerminalResponse>(&json_str, "ask_terminal_ai")
}

/// Suggest a complete shell command, given the user's partial input and the
/// recent terminal output as context.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn suggest_terminal_command(
    app: AppHandle,
    terminal_id: String,
    partial_input: String,
    recent_commands: Option<Vec<String>>,
    worktree_path: Option<String>,
    worktree_id: Option<String>,
    backend: Option<String>,
    model: Option<String>,
    reasoning_effort: Option<String>,
    custom_profile_name: Option<String>,
) -> Result<SuggestCommandResponse, String> {
    let buffer = strip_ansi(&snapshot_terminal_output(
        &terminal_id,
        Some(MAX_AI_BUFFER_BYTES),
    ));

    let prompt = build_suggest_prompt(
        &partial_input,
        recent_commands.as_deref().unwrap_or(&[]),
        &buffer,
    );
    let working_dir = worktree_path.as_deref().map(Path::new);

    let backend_choice =
        crate::chat::resolve_magic_prompt_backend(&app, backend.as_deref(), worktree_id.as_deref());

    let json_str = execute_one_shot(
        &app,
        backend_choice,
        &prompt,
        SUGGEST_COMMAND_SCHEMA,
        model.as_deref(),
        working_dir,
        reasoning_effort.as_deref(),
        custom_profile_name.as_deref(),
    )?;

    parse_response::<SuggestCommandResponse>(&json_str, "suggest_terminal_command")
}

fn build_ask_prompt(question: &str, buffer: &str) -> String {
    let buf_section = if buffer.trim().is_empty() {
        "(terminal has no recent output yet)".to_string()
    } else {
        format!("```text\n{}\n```", buffer.trim_end())
    };
    format!(
        "You are a terminal AI assistant helping a developer inside their shell. Be terse and \
practical — they're at a prompt, not reading docs. Ground your answer in the recent terminal \
output. If a single safe shell command would help, propose it in the `command` field; otherwise \
set `command` to null. Never propose destructive commands (rm -rf, dd, mkfs, format, shutdown). \
Return only the JSON object matching the schema.\n\n\
Recent terminal output:\n{buf_section}\n\n\
User question: {question}"
    )
}

fn build_suggest_prompt(partial: &str, recent_commands: &[String], buffer: &str) -> String {
    let buf_section = if buffer.trim().is_empty() {
        "(terminal has no recent output yet)".to_string()
    } else {
        format!("```text\n{}\n```", buffer.trim_end())
    };
    let partial_section = if partial.trim().is_empty() {
        "(user has not typed anything yet)".to_string()
    } else {
        format!("```text\n{partial}\n```")
    };
    let recent_commands_section = if recent_commands.is_empty() {
        "(no remembered commands yet)".to_string()
    } else {
        let commands = recent_commands
            .iter()
            .take(20)
            .map(|command| command.trim())
            .filter(|command| !command.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        format!("```text\n{commands}\n```")
    };
    format!(
        "You are a shell command auto-complete. Given the recent terminal output, remembered \
commands, and the user's partial input, propose the most likely complete command they want next. \
Prefer completing from remembered commands when they match the partial input or current project \
workflow. Output a SINGLE LINE command in the `command` field (no `$`, no markdown, no newline). \
Output one short sentence in the `explanation` field. Never propose destructive commands (rm -rf, \
dd, mkfs, format). If you can't infer anything useful, return `ls` with an explanation `Could not \
infer command — falling back to ls.`. Return only the JSON object.\n\n\
Recent terminal output:\n{buf_section}\n\n\
Remembered commands, newest first:\n{recent_commands_section}\n\n\
Partial input:\n{partial_section}"
    )
}

fn parse_response<T: serde::de::DeserializeOwned>(
    json_str: &str,
    context: &str,
) -> Result<T, String> {
    serde_json::from_str(json_str).map_err(|e| {
        log::error!("{context}: failed to parse AI response: {e}; raw: {json_str}");
        format!("AI returned malformed response: {e}")
    })
}

/// Dispatch a one-shot JSON-schema request to the configured backend.
#[allow(clippy::too_many_arguments)]
fn execute_one_shot(
    app: &AppHandle,
    backend: Backend,
    prompt: &str,
    schema: &str,
    model: Option<&str>,
    working_dir: Option<&Path>,
    reasoning_effort: Option<&str>,
    custom_profile_name: Option<&str>,
) -> Result<String, String> {
    match backend {
        Backend::Codex => {
            let model_str = model.unwrap_or("gpt-5.4");
            crate::chat::codex::execute_one_shot_codex(
                app,
                prompt,
                model_str,
                schema,
                working_dir,
                reasoning_effort,
            )
        }
        Backend::Opencode => {
            let model_str = model.unwrap_or("anthropic/claude-sonnet-4-6");
            crate::chat::opencode::execute_one_shot_opencode(
                app,
                prompt,
                model_str,
                Some(schema),
                working_dir,
                reasoning_effort,
            )
        }
        Backend::Cursor => {
            let model_str = model.unwrap_or("auto");
            let raw =
                crate::chat::cursor::execute_one_shot_cursor(app, prompt, model_str, working_dir)?;
            // Cursor doesn't support JSON-schema. Strip optional markdown code
            // fences and trust the model to have produced valid JSON.
            Ok(extract_json_blob(&raw))
        }
        Backend::Claude => execute_one_shot_claude(
            app,
            prompt,
            model.unwrap_or("haiku"),
            schema,
            working_dir,
            custom_profile_name,
        ),
    }
}

/// Strip optional ```json fences from a free-form response so the JSON
/// parser can read it.
fn extract_json_blob(text: &str) -> String {
    let t = text.trim();
    let without_prefix = t
        .strip_prefix("```json")
        .or_else(|| t.strip_prefix("```"))
        .unwrap_or(t)
        .trim();
    without_prefix
        .strip_suffix("```")
        .unwrap_or(without_prefix)
        .trim()
        .to_string()
}

/// One-shot Claude CLI call with `--json-schema`. Returns the JSON string from
/// Claude's StructuredOutput tool call.
fn execute_one_shot_claude(
    app: &AppHandle,
    prompt: &str,
    model: &str,
    schema: &str,
    working_dir: Option<&Path>,
    custom_profile_name: Option<&str>,
) -> Result<String, String> {
    let cli_path: PathBuf = resolve_cli_binary(app);
    if !cli_path.exists() {
        return Err("Claude CLI not installed".to_string());
    }

    let mut cmd = silent_command(&cli_path);
    crate::chat::claude::apply_custom_profile_settings(&mut cmd, custom_profile_name);
    cmd.args([
        "--print",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        model,
        "--no-session-persistence",
        "--max-turns",
        "2",
        "--json-schema",
        schema,
        "--permission-mode",
        "plan",
    ]);

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {e}"))?;

    {
        let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;
        let input_message = serde_json::json!({
            "type": "user",
            "message": { "role": "user", "content": prompt }
        });
        writeln!(stdin, "{input_message}")
            .map_err(|e| format!("Failed to write to Claude stdin: {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for Claude CLI: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Claude CLI failed (exit {:?}): {}",
            output.status.code(),
            stderr.trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    extract_structured_output_from_stream_json(&stdout)
}

/// Pull the StructuredOutput tool-call payload out of stream-json output.
/// Falls back to plain assistant text (stripped of code fences) so we still
/// have a chance when the model emits raw JSON instead of using the tool.
fn extract_structured_output_from_stream_json(output: &str) -> Result<String, String> {
    let mut text_content = String::new();
    let mut structured: Option<serde_json::Value> = None;

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(parsed) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if parsed.get("type").and_then(|t| t.as_str()) != Some("assistant") {
            continue;
        }
        let Some(content) = parsed
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_array())
        else {
            continue;
        };
        for block in content {
            let block_type = block.get("type").and_then(|t| t.as_str());
            if block_type == Some("text") {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    text_content.push_str(text);
                }
            } else if block_type == Some("tool_use")
                && block.get("name").and_then(|n| n.as_str()) == Some("StructuredOutput")
            {
                if let Some(input) = block.get("input") {
                    structured = Some(input.clone());
                }
            }
        }
    }

    if let Some(value) = structured {
        return Ok(value.to_string());
    }

    let trimmed = extract_json_blob(&text_content);
    if trimmed.starts_with('{') {
        return Ok(trimmed);
    }

    Err("Claude returned no structured output".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_ansi_removes_csi_sequences() {
        let s = "\x1b[31merror:\x1b[0m bad thing happened";
        assert_eq!(strip_ansi(s), "error: bad thing happened");
    }

    #[test]
    fn strip_ansi_preserves_newlines_and_tabs() {
        let s = "hello\nworld\there";
        assert_eq!(strip_ansi(s), "hello\nworld\there");
    }

    #[test]
    fn strip_ansi_removes_osc_sequences() {
        let s = "\x1b]0;window title\x07ls -la";
        assert_eq!(strip_ansi(s), "ls -la");
    }

    #[test]
    fn extract_json_blob_strips_markdown_fences() {
        assert_eq!(extract_json_blob("```json\n{\"a\":1}\n```"), r#"{"a":1}"#);
        assert_eq!(extract_json_blob("```\n{\"b\":2}\n```"), r#"{"b":2}"#);
        assert_eq!(extract_json_blob(r#"{"c":3}"#), r#"{"c":3}"#);
    }

    #[test]
    fn extract_structured_output_finds_tool_call() {
        let line = serde_json::json!({
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "tool_use", "name": "StructuredOutput", "input": {"answer": "hi", "command": null}}
                ]
            }
        });
        let output = line.to_string();
        let got = extract_structured_output_from_stream_json(&output).unwrap();
        let parsed: AskTerminalResponse = serde_json::from_str(&got).unwrap();
        assert_eq!(parsed.answer, "hi");
        assert!(parsed.command.is_none());
    }

    #[test]
    fn extract_structured_output_falls_back_to_text_json() {
        let line = serde_json::json!({
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "```json\n{\"answer\":\"x\",\"command\":\"ls\"}\n```"}
                ]
            }
        });
        let output = line.to_string();
        let got = extract_structured_output_from_stream_json(&output).unwrap();
        let parsed: AskTerminalResponse = serde_json::from_str(&got).unwrap();
        assert_eq!(parsed.answer, "x");
        assert_eq!(parsed.command.as_deref(), Some("ls"));
    }
}
