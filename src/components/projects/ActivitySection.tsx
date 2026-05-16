import { useCallback, useMemo, useState } from 'react'
import { Activity, ChevronRight } from '@/components/icons'
import { cn } from '@/lib/utils'
import { convertFileSrc, convertProjectFileSrc } from '@/lib/transport'
import { useAllSessions } from '@/services/chat'
import { useAppDataDir, useProjects } from '@/services/projects'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'
import { useUIStore } from '@/store/ui-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { SessionTypeIcon } from '@/components/chat/SessionTypeIcon'
import type { AllSessionsEntry, Session } from '@/types/chat'
import type { Project } from '@/types/projects'
import { isFinishedUnreadSession } from './project-sidebar-state'

type ActivityKind = 'pending' | 'unread'

interface ActivityItem {
  kind: ActivityKind
  session: Session
  entry: AllSessionsEntry
}

export function ActivitySection() {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useIsMobile()
  const { data: allSessions } = useAllSessions()
  const { data: projects = [] } = useProjects()
  const { data: appDataDir = '' } = useAppDataDir()

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>()
    for (const project of projects) map.set(project.id, project)
    return map
  }, [projects])

  const items = useMemo<ActivityItem[]>(() => {
    const result: ActivityItem[] = []
    for (const entry of allSessions?.entries ?? []) {
      for (const session of entry.sessions) {
        if (session.archived_at) continue
        const status = session.last_run_status
        if (status === 'running' || status === 'resumable') {
          result.push({ kind: 'pending', session, entry })
        } else if (isFinishedUnreadSession(session)) {
          result.push({ kind: 'unread', session, entry })
        }
      }
    }
    result.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'pending' ? -1 : 1
      return b.session.updated_at - a.session.updated_at
    })
    return result
  }, [allSessions])

  const count = items.length

  const handleToggle = useCallback(() => setIsOpen(prev => !prev), [])

  const handleSelect = useCallback(
    (item: ActivityItem) => {
      const { entry, session } = item
      useProjectsStore.getState().selectProject(entry.project_id)
      useProjectsStore.getState().selectWorktree(entry.worktree_id)
      useChatStore.getState().clearActiveWorktree()
      useChatStore.getState().setActiveSession(entry.worktree_id, session.id)
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('open-session-modal', {
            detail: {
              sessionId: session.id,
              worktreeId: entry.worktree_id,
              worktreePath: entry.worktree_path,
            },
          })
        )
      }, 50)
      if (isMobile) {
        useUIStore.getState().setLeftSidebarVisible(false)
      }
    },
    [isMobile]
  )

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="group/header flex w-full items-center justify-between pl-3 pr-2 pb-1 pt-2 text-left transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-hover/header:text-muted-foreground">
          <ChevronRight
            className={cn(
              'size-3 shrink-0 transition-transform',
              isOpen && 'rotate-90'
            )}
          />
          <Activity className="size-3 shrink-0" />
          Activity
        </span>
        {count > 0 && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
              count > 0
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-sidebar-accent/40 text-muted-foreground/80'
            )}
          >
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="py-0.5">
          {items.length === 0 ? (
            <div className="mx-1 px-3 py-2 text-xs text-muted-foreground/60">
              No pending or unread sessions
            </div>
          ) : (
            items.map(item => {
              const project = projectsById.get(item.entry.project_id)
              const avatarUrl =
                project?.avatar_path && appDataDir
                  ? convertFileSrc(`${appDataDir}/${project.avatar_path}`)
                  : project?.default_avatar_path
                    ? convertProjectFileSrc(project.default_avatar_path)
                    : null
              const isPending = item.kind === 'pending'
              const isResumable = item.session.last_run_status === 'resumable'

              return (
                <button
                  key={`${item.entry.worktree_id}-${item.session.id}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    'group relative mx-1 my-0.5 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-1.5 overflow-hidden rounded-md px-2 py-1 text-left transition-[background-color,color] duration-150',
                    isPending
                      ? 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                      : 'bg-emerald-500/10 text-sidebar-accent-foreground ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/15'
                  )}
                >
                  <StatusIndicator
                    status={isPending && !isResumable ? 'running' : 'completed'}
                    className="h-2 w-2"
                  />
                  <SessionTypeIcon
                    session={item.session}
                    className="h-3.5 w-3.5"
                  />
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="size-4 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-4 shrink-0 items-center justify-center rounded bg-muted-foreground/20">
                      <span className="text-[10px] font-medium uppercase">
                        {(project?.name ?? item.entry.project_name)[0]}
                      </span>
                    </div>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-xs font-medium">
                      {item.session.name || 'Untitled'}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground/70">
                      {item.entry.project_name}
                      <span className="mx-1 text-muted-foreground/40">·</span>
                      {item.entry.worktree_name}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
