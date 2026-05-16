import { Terminal } from '@/components/icons'
import { ClaudeIcon } from '@/components/icons/ClaudeIcon'
import { CodexIcon } from '@/components/icons/CodexIcon'
import { CursorIcon } from '@/components/icons/CursorIcon'
import { OpenCodeIcon } from '@/components/icons/OpenCodeIcon'
import { cn } from '@/lib/utils'
import type { Session } from '@/types/chat'

export function getSessionTypeLabel(session: Session): string {
  if (session.primary_surface === 'terminal' && !session.backend) {
    return 'Terminal'
  }

  switch (session.backend) {
    case 'claude':
      return 'Claude'
    case 'codex':
      return 'Codex'
    case 'opencode':
      return 'OpenCode'
    case 'cursor':
      return 'Cursor'
    default:
      return session.primary_surface === 'terminal' ? 'Terminal' : 'Session'
  }
}

export function SessionTypeIcon({
  session,
  className,
}: {
  session: Session
  className?: string
}) {
  const iconClassName = cn(
    'h-3.5 w-3.5 shrink-0 text-muted-foreground',
    className
  )
  const label = getSessionTypeLabel(session)

  switch (session.backend) {
    case 'claude':
      return <ClaudeIcon className={iconClassName} aria-label={label} />
    case 'codex':
      return <CodexIcon className={iconClassName} aria-label={label} />
    case 'opencode':
      return <OpenCodeIcon className={iconClassName} aria-label={label} />
    case 'cursor':
      return <CursorIcon className={iconClassName} aria-label={label} />
    default:
      return session.primary_surface === 'terminal' ? (
        <Terminal className={iconClassName} aria-label={label} />
      ) : (
        <ClaudeIcon className={iconClassName} aria-label={label} />
      )
  }
}
