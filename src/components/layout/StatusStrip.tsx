import { useMemo } from 'react'
import { Command, Wand2 } from '@/components/icons'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { isNativeApp } from '@/lib/environment'
import { useWsConnectionStatus } from '@/lib/transport'
import { useUIStore } from '@/store/ui-store'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'
import { usePreferences } from '@/services/preferences'
import { DEFAULT_KEYBINDINGS, formatShortcutDisplay } from '@/types/keybindings'
import { BackendLabel } from '@/components/ui/backend-label'

const MODE_TINT: Record<string, string> = {
  plan: 'text-sky-400',
  build: 'text-primary',
  yolo: 'text-amber-400',
}

const MODE_LABEL: Record<string, string> = {
  plan: 'Plan',
  build: 'Build',
  yolo: 'Yolo',
}

/**
 * Linear-style 24px persistent status strip at the bottom of the window.
 * Shows connection state, current backend/model/execution mode, and a
 * shortcut hint for the magic command menu.
 */
export function StatusStrip() {
  const connected = useWsConnectionStatus()
  const isWeb = !isNativeApp()

  const activeWorktreeId = useChatStore(s => s.activeWorktreeId)
  const selectedWorktreeId = useProjectsStore(s => s.selectedWorktreeId)
  const sessionChatModalWorktreeId = useUIStore(
    s => s.sessionChatModalWorktreeId
  )

  const currentWorktreeId =
    activeWorktreeId ?? sessionChatModalWorktreeId ?? selectedWorktreeId

  const activeSessionId = useChatStore(s =>
    currentWorktreeId ? s.activeSessionIds[currentWorktreeId] : undefined
  )

  const sessionBackend = useChatStore(s =>
    activeSessionId ? s.selectedBackends[activeSessionId] : undefined
  )
  const sessionModel = useChatStore(s =>
    activeSessionId ? s.selectedModels[activeSessionId] : undefined
  )
  const sessionExecutionMode = useChatStore(s =>
    activeSessionId ? s.executionModes[activeSessionId] : undefined
  )

  const { data: preferences } = usePreferences()

  const backend = (sessionBackend ?? preferences?.default_backend ?? 'claude') as
    | 'claude'
    | 'codex'
    | 'opencode'
    | 'cursor'
  const model = sessionModel ?? preferences?.selected_model ?? ''
  const mode = sessionExecutionMode ?? 'plan'

  const magicShortcut = useMemo(
    () =>
      formatShortcutDisplay(
        (preferences?.keybindings?.open_magic_modal ??
          DEFAULT_KEYBINDINGS.open_magic_modal) as string
      ),
    [preferences?.keybindings]
  )
  const paletteShortcut = useMemo(() => (isWeb ? '⌃ K' : '⌘ K'), [isWeb])

  const showSessionContext = !!currentWorktreeId

  return (
    <div
      data-slot="status-strip"
      className={cn(
        'flex h-6 shrink-0 items-center justify-between gap-3 border-t border-border/40 bg-background/85 backdrop-blur-md',
        'px-3 text-[11px] text-muted-foreground'
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Left — connection + session context */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex items-center gap-1.5"
          title={connected ? 'Connected' : 'Reconnecting…'}
        >
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
            )}
          />
          <span className="hidden sm:inline">
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
        </span>

        {showSessionContext && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <BackendLabel
                backend={backend}
                className="text-[11px] text-muted-foreground"
              />
              {model && (
                <span className="hidden truncate text-muted-foreground sm:inline">
                  {prettifyModelName(model)}
                </span>
              )}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                MODE_TINT[mode] ?? 'text-muted-foreground'
              )}
            >
              <span className="size-1 rounded-full bg-current opacity-80" />
              {MODE_LABEL[mode] ?? mode}
            </span>
          </>
        )}
      </div>

      {/* Right — shortcut hints */}
      <div className="flex items-center gap-3 text-muted-foreground/80">
        <button
          type="button"
          onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
          className="hidden items-center gap-1.5 rounded transition-colors hover:text-foreground sm:inline-flex"
        >
          <Command className="size-3" />
          <span>Palette</span>
          <Kbd className="h-3.5 text-[10px] bg-transparent text-muted-foreground/80 border-transparent px-1">
            {paletteShortcut}
          </Kbd>
        </button>
        {showSessionContext && (
          <button
            type="button"
            onClick={() => useUIStore.getState().setMagicModalOpen(true)}
            className="hidden items-center gap-1.5 rounded transition-colors hover:text-foreground sm:inline-flex"
          >
            <Wand2 className="size-3" />
            <span>Magic</span>
            <Kbd className="h-3.5 text-[10px] bg-transparent text-muted-foreground/80 border-transparent px-1">
              {magicShortcut}
            </Kbd>
          </button>
        )}
      </div>
    </div>
  )
}

function prettifyModelName(model: string): string {
  // Strip provider prefix (e.g. "anthropic/claude-...") and version suffixes.
  const last = model.split('/').pop() ?? model
  return last.replace(/^claude-/, '').replace(/^gpt-/, 'GPT-')
}
