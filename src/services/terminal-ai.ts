import { invoke } from '@/lib/transport'
import { generateId } from '@/lib/uuid'
import { useChatStore } from '@/store/chat-store'
import type { SaveTextResponse } from '@/types/chat'

/** Maximum bytes of buffer we fetch when attaching a terminal to a message. */
const TERMINAL_ATTACH_MAX_BYTES = 32 * 1024

/**
 * Snapshot a terminal's recent output, persist it as a text file in the app
 * data directory, and attach it to the current session's pending text files
 * so it ships with the next chat message. The AI then reads the file via its
 * `Read` tool — same channel as other text attachments.
 *
 * Returns the saved filename so the caller can show feedback (e.g. toast).
 */
export async function attachTerminalContext(
  sessionId: string,
  terminalId: string,
  terminalLabel: string
): Promise<{ filename: string; size: number }> {
  const buffer = await invoke<string>('get_terminal_buffer', {
    terminalId,
    maxBytes: TERMINAL_ATTACH_MAX_BYTES,
    stripAnsiCodes: true,
  })

  const trimmed = buffer.trimEnd()
  const header = `# Terminal: ${terminalLabel}\n# Captured at: ${new Date().toISOString()}\n# Note: ANSI escape codes have been stripped.\n\n`
  const content = trimmed
    ? header + trimmed + '\n'
    : header + '(terminal has no recent output)\n'

  const saved = await invoke<SaveTextResponse>('save_pasted_text', { content })

  useChatStore.getState().addPendingTextFile(sessionId, {
    id: saved.id ?? generateId(),
    path: saved.path,
    filename: saved.filename,
    size: saved.size,
    content,
  })

  return { filename: saved.filename, size: saved.size }
}
