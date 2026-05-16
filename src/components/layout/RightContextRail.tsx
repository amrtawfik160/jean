import { useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  ListTodo,
  Paperclip,
  Shield,
  Sparkles,
  Tag,
  X,
} from '@/components/icons'
import { LinearIcon } from '@/components/icons/LinearIcon'
import { cn } from '@/lib/utils'
import { openExternal } from '@/lib/platform'
import { useUIStore } from '@/store/ui-store'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'
import { useWorktree } from '@/services/projects'
import { useGitStatus } from '@/services/git-status'
import { useSessions } from '@/services/chat'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RightContextRailProps {
  width?: number
}

const PR_STATUS_TINT: Record<string, string> = {
  draft:
    'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30',
  open: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  merged: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  closed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

/**
 * Linear-style right context rail.
 *
 * Surfaces metadata for the active worktree/session that's otherwise buried:
 * - PR + check status (clickable to open GitHub)
 * - Source issue (GitHub or Linear)
 * - Security advisory link
 * - Branch + git status counts
 * - Attached files / contexts / images count
 * - User label
 *
 * Toggle via mod+shift+b. Slides in from the right with a spring.
 */
export function RightContextRail({ width = 280 }: RightContextRailProps) {
  const visible = useUIStore(s => s.rightSidebarVisible)
  const setVisible = useUIStore(s => s.setRightSidebarVisible)

  const activeWorktreeId = useChatStore(s => s.activeWorktreeId)
  const selectedWorktreeId = useProjectsStore(s => s.selectedWorktreeId)
  const sessionChatModalWorktreeId = useUIStore(
    s => s.sessionChatModalWorktreeId
  )
  const worktreeId =
    activeWorktreeId ?? sessionChatModalWorktreeId ?? selectedWorktreeId

  const { data: worktree } = useWorktree(worktreeId ?? null)
  const { data: gitStatus } = useGitStatus(worktreeId ?? null)
  const { data: sessionsData } = useSessions(
    worktreeId ?? null,
    worktree?.path ?? null
  )

  const activeSessionId = useChatStore(s =>
    worktreeId ? s.activeSessionIds[worktreeId] : undefined
  )

  // Attachment counts for the active session
  const pendingImages = useChatStore(s =>
    activeSessionId ? (s.pendingImages[activeSessionId] ?? []).length : 0
  )
  const pendingFiles = useChatStore(s =>
    activeSessionId ? (s.pendingFiles[activeSessionId] ?? []).length : 0
  )
  const pendingTextFiles = useChatStore(s =>
    activeSessionId ? (s.pendingTextFiles[activeSessionId] ?? []).length : 0
  )
  const pendingSkills = useChatStore(s =>
    activeSessionId ? (s.pendingSkills[activeSessionId] ?? []).length : 0
  )
  const attachmentTotal =
    pendingImages + pendingFiles + pendingTextFiles + pendingSkills

  const uncommittedAdded =
    gitStatus?.uncommitted_added ?? worktree?.cached_uncommitted_added ?? 0
  const uncommittedRemoved =
    gitStatus?.uncommitted_removed ?? worktree?.cached_uncommitted_removed ?? 0
  const unpushedCount =
    gitStatus?.unpushed_count ?? worktree?.cached_unpushed_count ?? 0
  const behindCount =
    gitStatus?.behind_count ?? worktree?.cached_behind_count ?? 0

  const sessions = sessionsData?.sessions ?? []
  const activeSessions = useMemo(
    () => sessions.filter(s => !s.archived_at),
    [sessions]
  )

  return (
    <AnimatePresence mode="wait" initial={false}>
      {visible && (
        <motion.aside
          key="right-context-rail"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          className="relative shrink-0 overflow-hidden border-l border-sidebar-border/60 bg-sidebar"
        >
          <div
            style={{ width }}
            className="flex h-full flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex h-9 shrink-0 items-center justify-between px-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Context
              </span>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                aria-label="Hide context rail"
              >
                <X className="size-3" />
              </button>
            </div>

            {!worktree ? (
              <RailEmpty />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
                {/* Branch / git status section */}
                <RailSection title="Branch">
                  <RailRow
                    icon={<GitBranch className="size-3.5" />}
                    label={worktree.branch}
                    truncate
                    badge={
                      worktree.base_branch
                        ? `from ${worktree.base_branch}`
                        : undefined
                    }
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {uncommittedAdded > 0 && (
                      <GitStatusPill
                        tint="emerald"
                        label={`+${uncommittedAdded}`}
                        tooltip="Uncommitted additions"
                      />
                    )}
                    {uncommittedRemoved > 0 && (
                      <GitStatusPill
                        tint="red"
                        label={`−${uncommittedRemoved}`}
                        tooltip="Uncommitted deletions"
                      />
                    )}
                    {unpushedCount > 0 && (
                      <GitStatusPill
                        tint="amber"
                        label={`↑${unpushedCount}`}
                        icon={<ArrowUp className="size-3" />}
                        tooltip={`${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''}`}
                      />
                    )}
                    {behindCount > 0 && (
                      <GitStatusPill
                        tint="sky"
                        label={`↓${behindCount}`}
                        icon={<ArrowDown className="size-3" />}
                        tooltip={`${behindCount} commit${behindCount > 1 ? 's' : ''} behind`}
                      />
                    )}
                    {uncommittedAdded === 0 &&
                      uncommittedRemoved === 0 &&
                      unpushedCount === 0 &&
                      behindCount === 0 && (
                        <span className="text-[11px] text-muted-foreground/60">
                          Clean
                        </span>
                      )}
                  </div>
                </RailSection>

                {/* Linked items */}
                {(worktree.pr_url ||
                  worktree.issue_number ||
                  worktree.linear_issue_identifier ||
                  worktree.security_alert_url ||
                  worktree.advisory_url) && (
                  <RailSection title="Linked">
                    {worktree.pr_url && (
                      <LinkRow
                        icon={<GitPullRequest className="size-3.5" />}
                        label={`PR #${worktree.pr_number}`}
                        href={worktree.pr_url}
                        pill={
                          worktree.cached_pr_status ? (
                            <StatusPill status={worktree.cached_pr_status} />
                          ) : null
                        }
                      />
                    )}
                    {worktree.issue_number && !worktree.pr_url && (
                      <LinkRow
                        icon={<GitPullRequest className="size-3.5" />}
                        label={`Issue #${worktree.issue_number}`}
                      />
                    )}
                    {worktree.linear_issue_identifier && (
                      <LinkRow
                        icon={<LinearIcon className="size-3.5" />}
                        label={worktree.linear_issue_identifier}
                      />
                    )}
                    {worktree.security_alert_url && (
                      <LinkRow
                        icon={<Shield className="size-3.5 text-amber-400" />}
                        label={`Security #${worktree.security_alert_number}`}
                        href={worktree.security_alert_url}
                      />
                    )}
                    {worktree.advisory_url && !worktree.security_alert_url && (
                      <LinkRow
                        icon={<Shield className="size-3.5 text-amber-400" />}
                        label={worktree.advisory_ghsa_id ?? 'Advisory'}
                        href={worktree.advisory_url}
                      />
                    )}
                  </RailSection>
                )}

                {/* Label */}
                {worktree.label && (
                  <RailSection title="Label">
                    <div
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-surface-2 px-2 py-1 text-xs"
                      style={{
                        color: worktree.label.color,
                        borderColor: `${worktree.label.color}40`,
                      }}
                    >
                      <Tag className="size-3" />
                      {worktree.label.name}
                    </div>
                  </RailSection>
                )}

                {/* Sessions summary */}
                <RailSection title="Sessions">
                  <RailRow
                    icon={<Sparkles className="size-3.5" />}
                    label={`${activeSessions.length} active`}
                    badge={
                      sessions.length !== activeSessions.length
                        ? `${sessions.length - activeSessions.length} archived`
                        : undefined
                    }
                  />
                </RailSection>

                {/* Attachments for current session */}
                {attachmentTotal > 0 && (
                  <RailSection title="Attachments">
                    {pendingImages > 0 && (
                      <RailRow
                        icon={<Paperclip className="size-3.5" />}
                        label={`${pendingImages} image${pendingImages > 1 ? 's' : ''}`}
                      />
                    )}
                    {pendingFiles > 0 && (
                      <RailRow
                        icon={<Paperclip className="size-3.5" />}
                        label={`${pendingFiles} file${pendingFiles > 1 ? 's' : ''}`}
                      />
                    )}
                    {pendingTextFiles > 0 && (
                      <RailRow
                        icon={<Paperclip className="size-3.5" />}
                        label={`${pendingTextFiles} text file${pendingTextFiles > 1 ? 's' : ''}`}
                      />
                    )}
                    {pendingSkills > 0 && (
                      <RailRow
                        icon={<ListTodo className="size-3.5" />}
                        label={`${pendingSkills} skill${pendingSkills > 1 ? 's' : ''}`}
                      />
                    )}
                  </RailSection>
                )}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function RailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function RailRow({
  icon,
  label,
  badge,
  truncate,
}: {
  icon: React.ReactNode
  label: string
  badge?: string
  truncate?: boolean
}) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span
        className={cn(
          'min-w-0 text-foreground',
          truncate && 'truncate font-mono text-[11px]'
        )}
      >
        {label}
      </span>
      {badge && (
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
          {badge}
        </span>
      )}
    </div>
  )
}

function LinkRow({
  icon,
  label,
  href,
  pill,
}: {
  icon: React.ReactNode
  label: string
  href?: string
  pill?: React.ReactNode
}) {
  const Wrapper: React.ElementType = href ? 'button' : 'div'
  return (
    <Wrapper
      type={href ? 'button' : undefined}
      onClick={href ? () => openExternal(href) : undefined}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs',
        href &&
          'transition-colors duration-150 hover:bg-sidebar-accent cursor-pointer'
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate text-foreground">{label}</span>
      {pill}
      {href && (
        <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground/60" />
      )}
    </Wrapper>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1.5 py-0 text-[10px] font-medium uppercase',
        PR_STATUS_TINT[status] ?? PR_STATUS_TINT.open
      )}
    >
      {status}
    </span>
  )
}

function GitStatusPill({
  tint,
  label,
  icon,
  tooltip,
}: {
  tint: 'emerald' | 'red' | 'amber' | 'sky'
  label: string
  icon?: React.ReactNode
  tooltip: string
}) {
  const tints: Record<string, string> = {
    emerald: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
    red: 'bg-red-500/12 text-red-400 border-red-500/25',
    amber: 'bg-amber-500/12 text-amber-400 border-amber-500/25',
    sky: 'bg-sky-500/12 text-sky-400 border-sky-500/25',
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded border px-1.5 py-0 text-[10px] font-medium tabular-nums',
            tints[tint]
          )}
        >
          {icon}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function RailEmpty() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center">
      <p className="text-xs text-muted-foreground/60 leading-relaxed">
        Open a worktree to see linked PRs, branch status, and attachments.
      </p>
    </div>
  )
}
