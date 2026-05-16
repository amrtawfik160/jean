import {
  FINISHED_UNREAD_STATUSES,
  isUnreadSession,
} from '@/components/unread/unread-utils'
import type { AllSessionsResponse, Session } from '@/types/chat'
import type { Worktree } from '@/types/projects'
import { isPanelTerminal, type TerminalInstance } from '@/store/terminal-store'

export function isFinishedUnreadSession(session: Session): boolean {
  return (
    !!session.last_run_status &&
    FINISHED_UNREAD_STATUSES.includes(session.last_run_status) &&
    isUnreadSession(session)
  )
}

export function getProjectsWithUnreadFinishedSessions(
  allSessions?: AllSessionsResponse
): Set<string> {
  const projectIds = new Set<string>()

  for (const entry of allSessions?.entries ?? []) {
    if (entry.sessions.some(isFinishedUnreadSession)) {
      projectIds.add(entry.project_id)
    }
  }

  return projectIds
}

export function projectHasLoadingWorktree(
  worktrees: Worktree[],
  worktreeLoadingOperations: Record<string, string | null>,
  sendingSessionIds: Record<string, boolean>,
  sessionWorktreeMap: Record<string, string>
): boolean {
  const worktreeIds = new Set(worktrees.map(worktree => worktree.id))

  for (const worktree of worktrees) {
    if (
      worktree.status === 'pending' ||
      worktree.status === 'deleting' ||
      !!worktreeLoadingOperations[worktree.id]
    ) {
      return true
    }
  }

  for (const [sessionId, isSending] of Object.entries(sendingSessionIds)) {
    if (isSending && worktreeIds.has(sessionWorktreeMap[sessionId] ?? '')) {
      return true
    }
  }

  return false
}

export function getProjectTerminalState(
  worktrees: Worktree[],
  terminalsByWorktree: Record<string, TerminalInstance[]>,
  runningTerminals: Set<string>,
  failedTerminals: Set<string>
): { hasRunningTerminal: boolean; hasFailedTerminal: boolean } {
  let hasRunningTerminal = false
  let hasFailedTerminal = false

  for (const worktree of worktrees) {
    const terminals = terminalsByWorktree[worktree.id] ?? []

    for (const terminal of terminals) {
      if (!isPanelTerminal(terminal) || !terminal.command) continue
      if (runningTerminals.has(terminal.id)) hasRunningTerminal = true
      if (failedTerminals.has(terminal.id)) hasFailedTerminal = true
    }
  }

  return { hasRunningTerminal, hasFailedTerminal }
}
