import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import {
  Archive,
  Command,
  LayoutDashboard,
  Menu,
  Plug,
  Plus,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { UsageRing } from '@/components/ui/usage-ring'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUIStore } from '@/store/ui-store'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'
import { usePreferences } from '@/services/preferences'
import { useWorktree } from '@/services/projects'
import {
  useClaudeCliAuth,
  useClaudeCliStatus,
  useClaudeUsage,
} from '@/services/claude-cli'
import {
  useCodexCliAuth,
  useCodexCliStatus,
  useCodexUsage,
} from '@/services/codex-cli'
import {
  useAttachedSavedContexts,
  useLoadedAdvisoryContexts,
  useLoadedIssueContexts,
  useLoadedPRContexts,
  useLoadedSecurityContexts,
} from '@/services/github'
import { useLoadedLinearIssueContexts } from '@/services/linear'
import { invoke } from '@/lib/transport'
import { DEFAULT_KEYBINDINGS, formatShortcutDisplay } from '@/types/keybindings'
import type { SessionDebugInfo } from '@/types/chat'
import {
  claudeUsageRows,
  codexUsageRows,
  UsagePlanPanel,
} from './UsagePlanPanel'

interface DockBurgerButtonProps {
  /** Number of enabled MCP servers; shown as a badge next to the MCP item. */
  activeMcpCount?: number
  /** Extra classes merged onto the trigger button (e.g. responsive visibility). */
  className?: string
}

const CONTEXT_LIMITS: Partial<
  Record<'claude' | 'codex' | 'opencode' | 'cursor', Record<string, number>>
> = {
  claude: {
    'claude-opus-4-7[1m]': 1_000_000,
    'claude-opus-4-6[1m]': 1_000_000,
    'claude-opus-4-6[1m]-fast': 1_000_000,
    'claude-sonnet-4-6[1m]': 1_000_000,
    'claude-opus-4-7': 200_000,
    'claude-opus-4-6': 200_000,
    'claude-opus-4-5-20251101': 200_000,
    sonnet: 200_000,
    opus: 200_000,
    haiku: 200_000,
  },
  codex: {
    'gpt-5.5': 400_000,
    'gpt-5.5-fast': 400_000,
    'gpt-5.4': 400_000,
    'gpt-5.4-fast': 400_000,
    'gpt-5.4-mini': 400_000,
    'gpt-5.4-mini-fast': 400_000,
  },
}

function getLatestRunInputTokens(debugInfo: SessionDebugInfo | undefined) {
  if (!debugInfo) return null

  for (const file of [...debugInfo.run_log_files].reverse()) {
    if (!file.usage) continue
    return file.usage.input_tokens + (file.usage.cache_read_input_tokens ?? 0)
  }

  return null
}

function UsageCircle({
  value,
  label,
}: {
  value: number | null
  label: string
}) {
  return <UsageRing value={value} size={12} thickness={0.25} label={label} />
}

function formatTokenCount(value: number | null | undefined): string {
  if (value == null) return '--'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K`
  return `${value}`
}

function ContextPanel({
  backend,
  model,
  contextTokens,
  contextLimit,
  contextPct,
  contextCounts,
}: {
  backend: string
  model: string | undefined
  contextTokens: number | null
  contextLimit: number | undefined
  contextPct: number | null
  contextCounts: { label: string; count: number }[]
}) {
  return (
    <div className="w-72 px-1 py-1">
      <div className="pb-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Current context
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Backend</span>
          <span className="truncate font-medium">{backend}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Model</span>
          <span className="truncate font-medium">{model ?? '--'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Input tokens</span>
          <span className="font-medium tabular-nums">
            {formatTokenCount(contextTokens)}
            {contextLimit ? ` / ${formatTokenCount(contextLimit)}` : ''}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, contextPct ?? 0))}%` }}
          />
        </div>
      </div>
      <div className="mt-3 border-t pt-2">
        {contextCounts.some(item => item.count > 0) ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {contextCounts
              .filter(item => item.count > 0)
              .map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                >
                  <span className="truncate text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="font-medium tabular-nums">{item.count}</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No attached issue, PR, security, Linear, or saved contexts.
          </p>
        )}
      </div>
    </div>
  )
}

export function DockBurgerButton({
  activeMcpCount = 0,
  className,
}: DockBurgerButtonProps = {}) {
  const isMobile = useIsMobile()
  const { data: preferences } = usePreferences()

  const activeWorktreeId = useChatStore(state => state.activeWorktreeId)
  const selectedWorktreeId = useProjectsStore(state => state.selectedWorktreeId)
  const sessionChatModalOpen = useUIStore(state => state.sessionChatModalOpen)
  const sessionChatModalWorktreeId = useUIStore(
    state => state.sessionChatModalWorktreeId
  )
  const currentWorktreeId = sessionChatModalOpen
    ? (sessionChatModalWorktreeId ?? activeWorktreeId ?? selectedWorktreeId)
    : (activeWorktreeId ?? selectedWorktreeId)
  const { data: currentWorktree } = useWorktree(currentWorktreeId ?? null)
  const currentProjectId = currentWorktree?.project_id ?? null
  const activeSessionId = useChatStore(state =>
    currentWorktreeId ? state.activeSessionIds[currentWorktreeId] : undefined
  )
  const selectedBackend = useChatStore(state =>
    activeSessionId ? state.selectedBackends[activeSessionId] : undefined
  )
  const sessionSelectedModel = useChatStore(state =>
    activeSessionId ? state.selectedModels[activeSessionId] : undefined
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const activeBackend = (selectedBackend ??
    preferences?.default_backend ??
    'claude') as 'claude' | 'codex' | 'opencode' | 'cursor'

  const codexStatus = useCodexCliStatus()
  const codexAuth = useCodexCliAuth({
    enabled: !!codexStatus.data?.installed,
  })
  const codexUsage = useCodexUsage({
    enabled:
      !!codexStatus.data?.installed &&
      !!codexAuth.data?.authenticated &&
      (menuOpen || activeBackend === 'codex'),
  })
  const claudeStatus = useClaudeCliStatus()
  const claudeAuth = useClaudeCliAuth({
    enabled: !!claudeStatus.data?.installed,
  })
  const claudeUsage = useClaudeUsage({
    enabled:
      activeBackend === 'claude' &&
      !!claudeStatus.data?.installed &&
      !!claudeAuth.data?.authenticated,
  })

  const queryClient = useQueryClient()
  const sessionDebug = useQuery({
    queryKey: ['session-debug-info', currentWorktreeId, activeSessionId],
    queryFn: () =>
      invoke<SessionDebugInfo>('get_session_debug_info', {
        worktreeId: currentWorktreeId,
        sessionId: activeSessionId,
      }),
    enabled: !!currentWorktreeId && !!activeSessionId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 20,
  })

  // Live in-flight token count from chat:token_usage events. The session-debug
  // query only sees usage after the run completes and metadata is persisted,
  // so the popover would otherwise show "--" during the entire run.
  const [liveTokens, setLiveTokens] = useState<number | null>(null)
  useEffect(() => {
    setLiveTokens(null)
    if (!activeSessionId || !currentWorktreeId) return
    const unlistenDone = listen<{
      session_id?: string
      worktree_id?: string
    }>('chat:done', event => {
      if (
        event.payload?.session_id !== activeSessionId ||
        event.payload?.worktree_id !== currentWorktreeId
      )
        return
      queryClient.invalidateQueries({
        queryKey: ['session-debug-info', currentWorktreeId, activeSessionId],
      })
    })
    const unlistenTokens = listen<{
      session_id?: string
      worktree_id?: string
      input_tokens?: number
      cache_read_input_tokens?: number
    }>('chat:token_usage', event => {
      if (
        event.payload?.session_id !== activeSessionId ||
        event.payload?.worktree_id !== currentWorktreeId
      )
        return
      const input = event.payload?.input_tokens ?? 0
      const cache = event.payload?.cache_read_input_tokens ?? 0
      setLiveTokens(input + cache)
    })
    return () => {
      unlistenDone.then(unlisten => unlisten()).catch(() => {})
      unlistenTokens.then(unlisten => unlisten()).catch(() => {})
    }
  }, [activeSessionId, currentWorktreeId, queryClient])
  const { data: loadedIssueContexts = [] } = useLoadedIssueContexts(
    activeSessionId ?? null,
    currentWorktreeId ?? null
  )
  const { data: loadedPRContexts = [] } = useLoadedPRContexts(
    activeSessionId ?? null,
    currentWorktreeId ?? null
  )
  const { data: loadedSecurityContexts = [] } = useLoadedSecurityContexts(
    activeSessionId ?? null,
    currentWorktreeId ?? null
  )
  const { data: loadedAdvisoryContexts = [] } = useLoadedAdvisoryContexts(
    activeSessionId ?? null,
    currentWorktreeId ?? null
  )
  const { data: loadedLinearContexts = [] } = useLoadedLinearIssueContexts(
    activeSessionId ?? null,
    currentWorktreeId ?? null,
    currentProjectId
  )
  const { data: attachedSavedContexts = [] } = useAttachedSavedContexts(
    activeSessionId ?? null
  )

  const selectedModel =
    activeBackend === 'codex'
      ? (sessionSelectedModel ?? preferences?.selected_codex_model)
      : activeBackend === 'claude'
        ? (sessionSelectedModel ?? preferences?.selected_model)
        : undefined
  const contextLimit = selectedModel
    ? CONTEXT_LIMITS[activeBackend]?.[selectedModel]
    : undefined
  // Prefer the live (in-flight) token count from chat:token_usage events; fall
  // back to the most-recent completed run's persisted usage from sessionDebug.
  const contextTokens = liveTokens ?? getLatestRunInputTokens(sessionDebug.data)
  const contextPct =
    contextLimit && contextTokens !== null
      ? (contextTokens / contextLimit) * 100
      : null
  const backendUsagePct =
    activeBackend === 'claude'
      ? (claudeUsage.data?.session?.usedPercent ?? null)
      : activeBackend === 'codex'
        ? (codexUsage.data?.session?.usedPercent ?? null)
        : null
  const showUsageCircles =
    !isMobile && (activeBackend === 'claude' || activeBackend === 'codex')
  const usageRows =
    activeBackend === 'claude'
      ? claudeUsageRows(claudeUsage.data)
      : codexUsageRows(codexUsage.data)

  const codexAvailable =
    !!codexStatus.data?.installed && !!codexAuth.data?.authenticated
  const showCodexUsage = activeBackend === 'codex' && codexAvailable
  const sessionPct = codexUsage.data?.session?.usedPercent ?? null
  const weeklyPct = codexUsage.data?.weekly?.usedPercent ?? null
  const planText =
    codexUsage.data?.planType && codexUsage.data.planType.trim().length > 0
      ? codexUsage.data.planType
      : '--'
  // Display remaining (100 - used) to match Codex/ChatGPT's native usage UI.
  const sessionRemaining =
    sessionPct === null ? null : Math.max(0, Math.min(100, 100 - sessionPct))
  const weeklyRemaining =
    weeklyPct === null ? null : Math.max(0, Math.min(100, 100 - weeklyPct))
  const sessionText =
    sessionRemaining === null ? '--' : `${Math.round(sessionRemaining)}`
  const weeklyText =
    weeklyRemaining === null ? '--' : `${Math.round(weeklyRemaining)}`

  const toggleMenu = useCallback(() => {
    setMenuOpen(prev => !prev)
  }, [])

  // Global shortcut — only respond when this instance is the visible variant.
  // Both desktop + mobile burgers mount; CSS (`hidden`/`@xl:hidden`) hides one.
  // `offsetParent === null` is true for `display: none`, so the hidden variant skips.
  useEffect(() => {
    const handler = () => {
      if (!triggerRef.current || triggerRef.current.offsetParent === null)
        return
      toggleMenu()
    }
    window.addEventListener('toggle-quick-menu', handler)
    return () => window.removeEventListener('toggle-quick-menu', handler)
  }, [toggleMenu])

  const githubShortcut = formatShortcutDisplay(
    (preferences?.keybindings?.open_github_dashboard ??
      DEFAULT_KEYBINDINGS.open_github_dashboard) as string
  )
  const menuShortcut = formatShortcutDisplay(
    (preferences?.keybindings?.open_quick_menu ??
      DEFAULT_KEYBINDINGS.open_quick_menu) as string
  )
  const contextCounts = [
    { label: 'Issues', count: loadedIssueContexts.length },
    { label: 'PRs', count: loadedPRContexts.length },
    {
      label: 'Security',
      count: loadedSecurityContexts.length + loadedAdvisoryContexts.length,
    },
    { label: 'Linear', count: loadedLinearContexts.length },
    { label: 'Saved', count: attachedSavedContexts.length },
  ]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                aria-label={`Menu (${menuShortcut})`}
                className={cn(
                  'flex h-7 items-center justify-center gap-1 px-2 rounded-md text-xs font-medium text-muted-foreground',
                  'transition-[background-color,color,transform] duration-150 active:scale-[0.97]',
                  'hover:bg-accent hover:text-foreground'
                )}
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Menu ({menuShortcut})</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="top"
          align="start"
          className="min-w-[240px]"
          onEscapeKeyDown={e => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={() =>
              useProjectsStore.getState().setAddProjectDialogOpen(true)
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('command:open-archived-modal')
              )
            }
          >
            <Archive className="mr-2 h-4 w-4" />
            Archives
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
          >
            <Command className="mr-2 h-4 w-4" />
            Command Palette
            {!isMobile && <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => useUIStore.getState().setGitHubDashboardOpen(true)}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            GitHub Dashboard
            {!isMobile && (
              <DropdownMenuShortcut>{githubShortcut}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() =>
              useUIStore.getState().openPreferencesPane('mcp-servers')
            }
          >
            <Plug
              className={
                activeMcpCount > 0
                  ? 'mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400'
                  : 'mr-2 h-4 w-4'
              }
            />
            MCP Servers
            {activeMcpCount > 0 && (
              <DropdownMenuShortcut>{activeMcpCount}</DropdownMenuShortcut>
            )}
          </DropdownMenuItem>

          {!isMobile && showCodexUsage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Codex usage · Plan: {planText}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  useUIStore.getState().openPreferencesPane('usage')
                }
              >
                Session | Weekly
                <DropdownMenuShortcut>
                  {sessionText}|{weeklyText}%
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {showUsageCircles && (
        <>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open current context"
                    className="hidden @xl:grid h-7 w-5 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <UsageCircle value={contextPct} label="Context" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Context</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" side="top" className="w-auto">
              <ContextPanel
                backend={activeBackend}
                model={selectedModel}
                contextTokens={contextTokens}
                contextLimit={contextLimit}
                contextPct={contextPct}
                contextCounts={contextCounts}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open usage"
                    className="hidden @xl:grid h-7 w-5 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <UsageCircle value={backendUsagePct} label="Usage" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Usage</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" side="top" className="w-80 p-0">
              <UsagePlanPanel
                rows={usageRows}
                planLabel={activeBackend === 'codex' ? planText : null}
                isLoading={
                  activeBackend === 'claude'
                    ? claudeUsage.isLoading
                    : codexUsage.isLoading
                }
                onOpenDetails={() =>
                  useUIStore.getState().openPreferencesPane('usage')
                }
              />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  )
}
