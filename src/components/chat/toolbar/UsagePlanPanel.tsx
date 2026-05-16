import { ArrowRight } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { ClaudeUsageSnapshot } from '@/types/claude-cli'
import type { CodexUsageSnapshot } from '@/types/codex-cli'

interface UsageWindow {
  usedPercent: number
  resetsAt: number | null
}

interface UsageRow {
  key: string
  label: string
  usage: UsageWindow | null
}

interface UsagePlanPanelProps {
  rows: UsageRow[]
  planLabel: string | null
  isLoading?: boolean
  emptyMessage?: string
  /** Click handler for the header arrow (e.g. open full usage settings). */
  onOpenDetails?: () => void
}

function clamp(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatResetsIn(epochSeconds: number | null): string | null {
  if (!epochSeconds) return null
  const now = Date.now() / 1000
  const delta = Math.max(0, epochSeconds - now)
  if (delta < 60) return 'resets <1m'
  const minutes = Math.round(delta / 60)
  if (minutes < 60) return `resets ${minutes}m`
  const hours = Math.round(delta / 3600)
  if (hours < 48) return `resets ${hours}h`
  const days = Math.round(delta / 86400)
  return `resets ${days}d`
}

function toneFor(percent: number): 'primary' | 'warning' | 'destructive' {
  if (percent >= 95) return 'destructive'
  if (percent >= 80) return 'warning'
  return 'primary'
}

function toneTextClass(tone: 'primary' | 'warning' | 'destructive') {
  switch (tone) {
    case 'warning':
      return 'text-[color:var(--warning)]'
    case 'destructive':
      return 'text-[color:var(--destructive)]'
    case 'primary':
    default:
      return 'text-foreground'
  }
}

function toneFillStyle(
  tone: 'primary' | 'warning' | 'destructive'
): React.CSSProperties {
  switch (tone) {
    case 'warning':
      return { background: 'var(--warning)' }
    case 'destructive':
      return { background: 'var(--destructive)' }
    case 'primary':
    default:
      return { background: 'var(--primary)' }
  }
}

function UsageRowItem({ label, usage }: { label: string; usage: UsageWindow }) {
  const percent = clamp(usage.usedPercent)
  // Tone stays keyed off used % so threshold semantics (warning at ≥80,
  // destructive at ≥95) are unchanged. Bar width and text both show remaining
  // so the visualization matches the number (fuller bar = more capacity left).
  const tone = toneFor(percent)
  const resetsLabel = formatResetsIn(usage.resetsAt)
  const remaining = clamp(100 - percent)
  const percentText =
    remaining < 1 && remaining > 0
      ? `${remaining.toFixed(1)}%`
      : `${Math.round(remaining)}%`

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[12px] leading-none">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          <span className={cn('font-medium', toneTextClass(tone))}>
            {percentText}
          </span>
          {resetsLabel && (
            <span className="ml-1.5 opacity-70">· {resetsLabel}</span>
          )}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{
          background:
            'color-mix(in oklch, var(--muted-foreground) 18%, transparent)',
        }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.max(2, remaining)}%`,
            ...toneFillStyle(tone),
          }}
        />
      </div>
    </div>
  )
}

export function UsagePlanPanel({
  rows,
  planLabel,
  isLoading,
  emptyMessage,
  onOpenDetails,
}: UsagePlanPanelProps) {
  const visibleRows = rows.filter(row => row.usage !== null) as {
    key: string
    label: string
    usage: UsageWindow
  }[]

  return (
    <div className="px-3 py-3">
      <button
        type="button"
        onClick={onOpenDetails}
        disabled={!onOpenDetails}
        className={cn(
          'group flex w-full items-center justify-between gap-2 pb-2.5',
          'text-[11px] uppercase tracking-[0.08em] text-muted-foreground',
          onOpenDetails
            ? 'cursor-pointer hover:text-foreground'
            : 'cursor-default'
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span>Plan usage</span>
          {planLabel && (
            <span className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-muted-foreground">
              {planLabel}
            </span>
          )}
        </span>
        {onOpenDetails && (
          <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
        )}
      </button>

      {isLoading && (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="h-3 w-24 rounded bg-muted/40" />
                <span className="h-3 w-12 rounded bg-muted/40" />
              </div>
              <div className="h-1 w-full rounded-full bg-muted/30" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && visibleRows.length === 0 && (
        <p className="px-0.5 py-1 text-[12px] text-muted-foreground">
          {emptyMessage ?? 'No usage data available.'}
        </p>
      )}

      {!isLoading && visibleRows.length > 0 && (
        <div className="space-y-3">
          {visibleRows.map(row => (
            <UsageRowItem key={row.key} label={row.label} usage={row.usage} />
          ))}
        </div>
      )}
    </div>
  )
}

export function claudeUsageRows(
  snapshot: ClaudeUsageSnapshot | undefined
): UsageRow[] {
  if (!snapshot) return []
  return [
    {
      key: 'session',
      label: '5-hour limit',
      usage: snapshot.session,
    },
    {
      key: 'weekly',
      label: 'Weekly · all models',
      usage: snapshot.weekly,
    },
    {
      key: 'sonnetWeekly',
      label: 'Sonnet only',
      usage: snapshot.sonnetWeekly,
    },
  ]
}

export function codexUsageRows(
  snapshot: CodexUsageSnapshot | undefined
): UsageRow[] {
  if (!snapshot) return []
  const base: UsageRow[] = [
    {
      key: 'session',
      label: '5-hour limit',
      usage: snapshot.session,
    },
    {
      key: 'weekly',
      label: 'Weekly · all models',
      usage: snapshot.weekly,
    },
  ]
  if (snapshot.reviews) {
    base.push({ key: 'reviews', label: 'Reviews', usage: snapshot.reviews })
  }
  for (const limit of snapshot.modelLimits ?? []) {
    if (limit.weekly) {
      base.push({
        key: `${limit.label}-weekly`,
        label: limit.label,
        usage: limit.weekly,
      })
    } else if (limit.session) {
      base.push({
        key: `${limit.label}-session`,
        label: limit.label,
        usage: limit.session,
      })
    }
  }
  return base
}

/** Highest usedPercent across all rows; returns null if no data. */
export function peakUsagePercent(rows: UsageRow[]): number | null {
  let peak: number | null = null
  for (const row of rows) {
    if (!row.usage) continue
    const p = clamp(row.usage.usedPercent)
    if (peak === null || p > peak) peak = p
  }
  return peak
}
