import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Play, Sparkles, X } from '@/components/icons'
import { invoke } from '@/lib/transport'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getRecentTerminalCommands,
  getTerminalCurrentInput,
  recordTerminalCommand,
} from '@/lib/terminal-instances'

export type TerminalAIMode = 'ask' | 'suggest'

interface AskTerminalResponse {
  answer: string
  command: string | null
}

interface SuggestTerminalResponse {
  command: string
  explanation: string
}

interface TerminalAIBarProps {
  worktreeId: string
  worktreePath: string
  terminalId: string | undefined
  open: boolean
  initialMode?: TerminalAIMode
  onClose: () => void
}

const ASK_PLACEHOLDER =
  'Ask the AI… (Enter to ask, empty + Enter for a smart suggestion)'

/**
 * Floating AI overlay rendered on top of the active terminal. Supports two
 * flows that share the same UI:
 *
 *   `ask`     — user types a question, AI answers with optional command.
 *   `suggest` — auto-fires on open, AI proposes a likely-next command.
 *
 * The user can run the suggested command (writes to the PTY) or copy it.
 */
export const TerminalAIBar = memo(function TerminalAIBar({
  worktreeId,
  worktreePath,
  terminalId,
  open,
  initialMode = 'ask',
  onClose,
}: TerminalAIBarProps) {
  const [mode, setMode] = useState<TerminalAIMode>(initialMode)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [answer, setAnswer] = useState<string>('')
  const [command, setCommand] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [partialInput, setPartialInput] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const requestIdRef = useRef(0)

  const resetResponse = useCallback(() => {
    setAnswer('')
    setCommand(null)
    setExplanation('')
    setError(null)
  }, [])

  const runSuggest = useCallback(async () => {
    if (!terminalId) return
    const currentPartialInput = getTerminalCurrentInput(terminalId)
    const recentCommands = getRecentTerminalCommands(terminalId)
    setPartialInput(currentPartialInput)
    const reqId = ++requestIdRef.current
    setIsLoading(true)
    resetResponse()
    try {
      const result = await invoke<SuggestTerminalResponse>(
        'suggest_terminal_command',
        {
          terminalId,
          partialInput: currentPartialInput,
          recentCommands,
          worktreePath,
          worktreeId,
        }
      )
      if (reqId !== requestIdRef.current) return
      setCommand(result.command || null)
      setExplanation(result.explanation ?? '')
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setError(String(e))
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false)
    }
  }, [terminalId, worktreePath, worktreeId, resetResponse])

  const runAsk = useCallback(
    async (question: string) => {
      if (!terminalId) return
      const reqId = ++requestIdRef.current
      setIsLoading(true)
      resetResponse()
      try {
        const result = await invoke<AskTerminalResponse>('ask_terminal_ai', {
          terminalId,
          question,
          worktreePath,
          worktreeId,
        })
        if (reqId !== requestIdRef.current) return
        setAnswer(result.answer ?? '')
        setCommand(result.command ?? null)
      } catch (e) {
        if (reqId !== requestIdRef.current) return
        setError(String(e))
      } finally {
        if (reqId === requestIdRef.current) setIsLoading(false)
      }
    },
    [terminalId, worktreePath, worktreeId, resetResponse]
  )

  // Reset state and focus input when the bar opens.
  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setInput('')
    setPartialInput('')
    resetResponse()
    // requestIdRef bump cancels any in-flight responses from a previous open.
    requestIdRef.current += 1
    setIsLoading(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, initialMode, resetResponse])

  // Auto-run suggestion when opened in 'suggest' mode.
  useEffect(() => {
    if (!open) return
    if (initialMode === 'suggest') {
      void runSuggest()
    }
  }, [open, initialMode, runSuggest])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed) {
        setMode('suggest')
        void runSuggest()
        return
      }
      setMode('ask')
      void runAsk(trimmed)
    },
    [input, runAsk, runSuggest]
  )

  const handleRunCommand = useCallback(async () => {
    if (!command || !terminalId) return
    try {
      // Write the command with CR so the shell executes immediately.
      const replacementPrefix = '\u007f'.repeat(partialInput.length)
      await invoke('terminal_write', {
        terminalId,
        data: replacementPrefix + command + '\r',
      })
      recordTerminalCommand(terminalId, command)
      onClose()
    } catch (e) {
      toast.error(`Failed to run command: ${e}`)
    }
  }, [command, partialInput, terminalId, onClose])

  const handleInsertCommand = useCallback(async () => {
    if (!command || !terminalId) return
    try {
      // Write the command WITHOUT CR so the user can review and edit before
      // pressing Enter.
      const replacementPrefix = '\u007f'.repeat(partialInput.length)
      await invoke('terminal_write', {
        terminalId,
        data: replacementPrefix + command,
      })
      recordTerminalCommand(terminalId, command)
      onClose()
    } catch (e) {
      toast.error(`Failed to insert command: ${e}`)
    }
  }, [command, partialInput, terminalId, onClose])

  const handleCopyCommand = useCallback(async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      toast.success('Command copied')
    } catch (e) {
      toast.error(`Failed to copy: ${e}`)
    }
  }, [command])

  // Esc closes the bar.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () =>
      document.removeEventListener('keydown', handler, { capture: true })
  }, [open, onClose])

  const placeholder = useMemo(() => {
    if (mode === 'suggest') {
      return 'Optional: refine your suggestion request, or press Enter to ask again.'
    }
    return ASK_PLACEHOLDER
  }, [mode])

  if (!open) return null

  return (
    <div
      data-testid="terminal-ai-bar"
      className="pointer-events-auto absolute inset-x-2 top-2 z-30 rounded-md border border-border bg-background/95 shadow-lg backdrop-blur"
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
            <Kbd className="text-[9px]">Enter</Kbd>
            <span>send</span>
            <Kbd className="text-[9px]">Esc</Kbd>
            <span>close</span>
          </span>
        )}
        <button
          type="button"
          aria-label="Close AI bar"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>

      {(answer || command || error) && (
        <div className="border-t border-border px-3 py-2 text-sm">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            <>
              {answer && (
                <p className="whitespace-pre-wrap text-foreground">{answer}</p>
              )}
              {mode === 'suggest' && explanation && (
                <p className="text-xs text-muted-foreground">
                  {partialInput && (
                    <span className="font-mono">
                      Completing “{partialInput}”:{' '}
                    </span>
                  )}
                  {explanation}
                </p>
              )}
              {command && (
                <div className="mt-2 flex flex-col gap-2">
                  <code
                    className={cn(
                      'block rounded bg-muted px-2 py-1.5 text-xs font-mono',
                      'whitespace-pre-wrap break-words'
                    )}
                  >
                    {command}
                  </code>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunCommand}
                      className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Play className="h-3 w-3" />
                      Run in terminal
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertCommand}
                      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      Insert without running
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCommand}
                      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
})
