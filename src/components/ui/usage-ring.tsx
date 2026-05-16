import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface UsageRingProps {
  /** Percent fill 0..100. `null` renders an empty/unknown ring. */
  value: number | null
  /** Visible diameter in px. Track + foreground scale automatically. */
  size?: number
  /** Track thickness as a fraction of the diameter (0..0.5). */
  thickness?: number
  /** Optional content centered inside the ring (typically an icon). */
  children?: ReactNode
  /** Accessibility label. */
  label?: string
  /** Tone applied to the fill arc. */
  tone?: 'primary' | 'warning' | 'destructive' | 'success'
  className?: string
}

function toneColor(tone: NonNullable<UsageRingProps['tone']>) {
  switch (tone) {
    case 'warning':
      return 'var(--warning)'
    case 'destructive':
      return 'var(--destructive)'
    case 'success':
      return 'var(--success)'
    case 'primary':
    default:
      return 'var(--primary)'
  }
}

function clampPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return Math.max(0, Math.min(100, value))
}

/**
 * Circular usage indicator built from a conic-gradient ring with a centered
 * slot for content (icon, glyph, percent). Used as both an inline glyph and
 * a primary toolbar button — pick the `size` that fits the context.
 */
export function UsageRing({
  value,
  size = 14,
  thickness = 0.22,
  children,
  label,
  tone = 'primary',
  className,
}: UsageRingProps) {
  const percent = clampPercent(value)
  const accentTone = (() => {
    if (percent === null) return tone
    if (percent >= 95) return 'destructive'
    if (percent >= 80) return 'warning'
    return tone
  })()
  const fill = toneColor(accentTone)
  const a11y =
    percent === null
      ? `${label ?? 'Usage'}: unknown`
      : `${label ?? 'Usage'}: ${Math.round(percent)}%`
  const padding = Math.max(1, Math.round(size * thickness))
  const innerSize = size - padding * 2

  return (
    <span
      role="img"
      aria-label={a11y}
      title={a11y}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-full',
        className
      )}
      style={{
        width: size,
        height: size,
        background:
          percent === null
            ? 'color-mix(in oklch, var(--muted-foreground) 30%, transparent)'
            : `conic-gradient(${fill} ${percent * 3.6}deg, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 0deg)`,
      }}
    >
      <span
        className="grid place-items-center rounded-full bg-background"
        style={{ width: innerSize, height: innerSize }}
      >
        {children}
      </span>
    </span>
  )
}
