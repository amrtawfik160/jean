import { useMemo } from 'react'
import { ClaudeIcon } from '@/components/icons/ClaudeIcon'
import { CodexIcon } from '@/components/icons/CodexIcon'
import { useUIStore } from '@/store/ui-store'
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
import type { ClaudeUsageWindowSnapshot } from '@/types/claude-cli'
import type { CodexUsageWindowSnapshot } from '@/types/codex-cli'

interface UsageWindow {
  usedPercent: number
  resetsAt: number | null
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatPercent(value: number | null | undefined) {
  const percent = clampPercent(value)
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`
  return `${Math.round(percent)}%`
}

function formatReset(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return '—'

  const deltaSeconds = epochSeconds - Date.now() / 1000
  if (deltaSeconds <= 0) return 'now'
  if (deltaSeconds < 60) return '<1m'

  const minutes = Math.round(deltaSeconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(deltaSeconds / 3600)
  if (hours < 48) return `${hours}h`

  const days = Math.round(deltaSeconds / 86400)
  return `${days}d`
}

function barColor(percent: number) {
  if (percent >= 95) return 'bg-[color:var(--destructive)]'
  if (percent >= 80) return 'bg-[color:var(--warning)]'
  return 'bg-primary'
}

function MiniUsageRow({
  label,
  usage,
}: {
  label: string
  usage: UsageWindow | null | undefined
}) {
  // Display "remaining" to match Codex/ChatGPT's native usage UI. Bar fill
  // visualizes remaining capacity (fuller = more left), with red when remaining
  // is critically low — same threshold semantics as before, just inverted.
  const usedPercent = clampPercent(usage?.usedPercent)
  const remainingPercent = usage ? 100 - usedPercent : 0
  const hasUsage =
    typeof usage?.usedPercent === 'number' && !Number.isNaN(usage.usedPercent)

  return (
    <div className="flex items-center gap-1.5 text-[10px] leading-none">
      <span className="w-6 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-sidebar-accent">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColor(usedPercent)}`}
          style={{
            width: hasUsage ? `${Math.max(2, remainingPercent)}%` : '0%',
          }}
        />
      </div>
      <span className="shrink-0 text-muted-foreground tabular-nums">
        <span className="text-foreground/90">
          {hasUsage ? formatPercent(remainingPercent) : '—'}
        </span>
        <span className="ml-0.5 opacity-70">
          ·{formatReset(usage?.resetsAt)}
        </span>
      </span>
    </div>
  )
}

function BackendUsageBlock({
  label,
  Icon,
  session,
  weekly,
  isLoading,
  status,
  errorMessage,
}: {
  label: string
  Icon: typeof ClaudeIcon
  session:
    | ClaudeUsageWindowSnapshot
    | CodexUsageWindowSnapshot
    | null
    | undefined
  weekly:
    | ClaudeUsageWindowSnapshot
    | CodexUsageWindowSnapshot
    | null
    | undefined
  isLoading: boolean
  status: 'ready' | 'unavailable' | 'error'
  errorMessage?: string | null
}) {
  const statusLabel = useMemo(() => {
    if (isLoading) return 'Loading'
    if (status === 'error') return 'Error'
    if (status === 'unavailable') return 'Sign in'
    return null
  }, [isLoading, status])

  return (
    <div className="space-y-1 rounded-md bg-sidebar-accent/35 px-1.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-sidebar-foreground">
          <Icon className="size-2.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {statusLabel && (
          <span
            className="shrink-0 text-[8px] uppercase tracking-wide text-muted-foreground/70"
            title={status === 'error' ? (errorMessage ?? undefined) : undefined}
          >
            {statusLabel}
          </span>
        )}
      </div>
      {status === 'ready' || isLoading ? (
        <div className="space-y-0.5">
          <MiniUsageRow label="5h" usage={session} />
          <MiniUsageRow label="7d" usage={weekly} />
        </div>
      ) : status === 'error' && errorMessage ? (
        <p
          className="text-[9px] leading-snug text-muted-foreground line-clamp-2"
          title={errorMessage}
        >
          {errorMessage}
        </p>
      ) : (
        <p className="text-[9px] leading-snug text-muted-foreground">
          Usage unavailable.
        </p>
      )}
    </div>
  )
}

export function SidebarUsageCard() {
  const codexStatus = useCodexCliStatus()
  const codexAuth = useCodexCliAuth({ enabled: !!codexStatus.data?.installed })
  const codexUsage = useCodexUsage({
    enabled: !!codexStatus.data?.installed && !!codexAuth.data?.authenticated,
  })

  const claudeStatus = useClaudeCliStatus()
  const claudeAuth = useClaudeCliAuth({
    enabled: !!claudeStatus.data?.installed,
  })
  const claudeUsage = useClaudeUsage({
    enabled: !!claudeStatus.data?.installed && !!claudeAuth.data?.authenticated,
  })

  const codexReady =
    !!codexStatus.data?.installed && !!codexAuth.data?.authenticated
  const claudeReady =
    !!claudeStatus.data?.installed && !!claudeAuth.data?.authenticated

  return (
    <button
      type="button"
      onClick={() => useUIStore.getState().openPreferencesPane('usage')}
      className="mx-1.5 mb-1.5 block rounded-md border border-sidebar-border bg-sidebar/80 px-1 py-1 text-left shadow-sm transition-colors hover:bg-sidebar-accent/50"
      aria-label="Open Claude and Codex usage details"
    >
      <div className="space-y-1">
        <BackendUsageBlock
          label="Codex"
          Icon={CodexIcon}
          session={codexUsage.data?.session}
          weekly={codexUsage.data?.weekly}
          isLoading={codexReady && codexUsage.isLoading}
          status={
            codexUsage.isError ? 'error' : codexReady ? 'ready' : 'unavailable'
          }
          errorMessage={
            codexUsage.error instanceof Error
              ? codexUsage.error.message
              : codexUsage.error
                ? String(codexUsage.error)
                : null
          }
        />
        <BackendUsageBlock
          label="Claude"
          Icon={ClaudeIcon}
          session={claudeUsage.data?.session}
          weekly={claudeUsage.data?.weekly}
          isLoading={claudeReady && claudeUsage.isLoading}
          status={
            claudeUsage.isError
              ? 'error'
              : claudeReady
                ? 'ready'
                : 'unavailable'
          }
          errorMessage={
            claudeUsage.error instanceof Error
              ? claudeUsage.error.message
              : claudeUsage.error
                ? String(claudeUsage.error)
                : null
          }
        />
      </div>
    </button>
  )
}
