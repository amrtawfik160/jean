import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Folder } from '@/components/icons'
import { cn } from '@/lib/utils'
import { convertFileSrc } from '@/lib/transport'
import { useProjects, useWorktree, useAppDataDir } from '@/services/projects'
import { useSessions } from '@/services/chat'
import { useChatStore } from '@/store/chat-store'
import { useProjectsStore } from '@/store/projects-store'
import { useUIStore } from '@/store/ui-store'

/**
 * Linear-style breadcrumb: Project › Worktree › Session.
 *
 * Each segment is clickable: project name opens project canvas, worktree
 * name selects the worktree, session name does nothing (already shown).
 * Falls back to a single "Jean" label when nothing is selected.
 */
export function BreadcrumbBar({ className }: { className?: string }) {
  const selectedProjectId = useProjectsStore(s => s.selectedProjectId)
  const selectedWorktreeId = useProjectsStore(s => s.selectedWorktreeId)
  const activeWorktreeId = useChatStore(s => s.activeWorktreeId)
  const sessionChatModalOpen = useUIStore(s => s.sessionChatModalOpen)
  const sessionChatModalWorktreeId = useUIStore(
    s => s.sessionChatModalWorktreeId
  )

  const worktreeIdForData =
    activeWorktreeId ?? sessionChatModalWorktreeId ?? selectedWorktreeId

  const { data: projects } = useProjects()
  const { data: worktree } = useWorktree(worktreeIdForData)
  const { data: appDataDir } = useAppDataDir()
  const { data: sessionsData } = useSessions(
    worktreeIdForData,
    worktree?.path ?? null
  )

  const project = useMemo(() => {
    if (worktree) return projects?.find(p => p.id === worktree.project_id)
    if (selectedProjectId)
      return projects?.find(p => p.id === selectedProjectId)
    return null
  }, [projects, worktree, selectedProjectId])

  const activeSessionId = useChatStore(s =>
    worktreeIdForData ? s.activeSessionIds[worktreeIdForData] : undefined
  )
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null
    return sessionsData?.sessions.find(s => s.id === activeSessionId) ?? null
  }, [activeSessionId, sessionsData?.sessions])

  // Show breadcrumb only when there's something meaningful
  const showWorktree =
    worktree && (activeWorktreeId || sessionChatModalOpen || selectedWorktreeId)
  const showSession =
    activeSession && (activeWorktreeId || sessionChatModalOpen)

  const projectAvatarUrl =
    project?.avatar_path && appDataDir
      ? convertFileSrc(`${appDataDir}/${project.avatar_path}`)
      : null

  const handleProjectClick = () => {
    if (!project) return
    useChatStore.getState().clearActiveWorktree()
    useProjectsStore.getState().selectProject(project.id)
  }

  const handleWorktreeClick = () => {
    if (!worktree) return
    useChatStore.getState().clearActiveWorktree()
    useProjectsStore.getState().selectWorktree(worktree.id)
  }

  if (!project) {
    return (
      <div
        className={cn(
          'flex items-center text-sm font-medium text-foreground',
          className
        )}
      >
        Jean
      </div>
    )
  }

  return (
    <nav
      aria-label="breadcrumb"
      className={cn('flex min-w-0 items-center gap-1 text-sm', className)}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={handleProjectClick}
        className={cn(
          'group/crumb inline-flex h-6 max-w-[160px] items-center gap-1.5 rounded-md px-1.5',
          'transition-colors duration-150 hover:bg-accent',
          showWorktree ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {projectAvatarUrl ? (
          <img
            src={projectAvatarUrl}
            alt=""
            className="size-3.5 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-muted-foreground/20">
            <Folder className="size-2.5 text-muted-foreground" />
          </div>
        )}
        <span className="truncate">{project.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {showWorktree && worktree && (
          <motion.span
            key="worktree-segment"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="flex min-w-0 items-center gap-1"
          >
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
            <button
              type="button"
              onClick={handleWorktreeClick}
              className={cn(
                'inline-flex h-6 max-w-[200px] items-center rounded-md px-1.5',
                'transition-colors duration-150 hover:bg-accent',
                showSession ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              <span className="truncate">{worktree.name}</span>
              {worktree.branch !== worktree.name && (
                <span className="ml-1.5 truncate text-xs text-muted-foreground/70">
                  {worktree.branch}
                </span>
              )}
            </button>
          </motion.span>
        )}
        {showSession && activeSession && (
          <motion.span
            key="session-segment"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="flex min-w-0 items-center gap-1"
          >
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
            <span
              className="inline-flex h-6 max-w-[260px] items-center px-1.5 text-foreground"
              title={activeSession.name || activeSession.id}
            >
              <span className="truncate">
                {activeSession.name || 'Untitled session'}
              </span>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </nav>
  )
}
