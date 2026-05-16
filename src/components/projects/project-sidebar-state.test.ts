import { describe, expect, it } from 'vitest'
import type { AllSessionsResponse, Session } from '@/types/chat'
import type { Worktree } from '@/types/projects'
import type { TerminalInstance } from '@/store/terminal-store'
import {
  getProjectTerminalState,
  getProjectsWithUnreadFinishedSessions,
  isFinishedUnreadSession,
  projectHasLoadingWorktree,
} from './project-sidebar-state'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    name: 'Session 1',
    order: 0,
    created_at: 1,
    updated_at: 10,
    messages: [],
    ...overrides,
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'worktree-1',
    project_id: 'project-1',
    name: 'main',
    path: '/tmp/project-1',
    branch: 'main',
    created_at: 1,
    order: 0,
    ...overrides,
  }
}

function makeTerminal(
  overrides: Partial<TerminalInstance> = {}
): TerminalInstance {
  return {
    id: 'terminal-1',
    worktreeId: 'worktree-1',
    command: 'pnpm dev',
    label: 'pnpm',
    kind: 'panel',
    ...overrides,
  }
}

describe('project sidebar state helpers', () => {
  it('treats completed unread sessions as finished unread', () => {
    const session = makeSession({
      last_run_status: 'completed',
      last_opened_at: 5,
      updated_at: 10,
    })

    expect(isFinishedUnreadSession(session)).toBe(true)
  })

  it('does not treat waiting-only unread sessions as finished unread', () => {
    const session = makeSession({
      waiting_for_input: true,
      waiting_for_input_type: 'question',
      last_opened_at: 5,
      updated_at: 10,
    })

    expect(isFinishedUnreadSession(session)).toBe(false)
  })

  it('collects only projects with finished unread sessions', () => {
    const allSessions: AllSessionsResponse = {
      entries: [
        {
          project_id: 'project-1',
          project_name: 'Alpha',
          worktree_id: 'worktree-1',
          worktree_name: 'main',
          worktree_path: '/tmp/alpha',
          sessions: [
            makeSession({
              id: 'session-a',
              last_run_status: 'completed',
              last_opened_at: 5,
              updated_at: 10,
            }),
          ],
        },
        {
          project_id: 'project-2',
          project_name: 'Beta',
          worktree_id: 'worktree-2',
          worktree_name: 'main',
          worktree_path: '/tmp/beta',
          sessions: [
            makeSession({
              id: 'session-b',
              waiting_for_input: true,
              waiting_for_input_type: 'question',
              last_opened_at: 5,
              updated_at: 10,
            }),
          ],
        },
      ],
    }

    expect([...getProjectsWithUnreadFinishedSessions(allSessions)]).toEqual([
      'project-1',
    ])
  })

  it('flags projects with pending or actively loading worktrees', () => {
    expect(
      projectHasLoadingWorktree(
        [
          makeWorktree({ id: 'pending-worktree', status: 'pending' }),
          makeWorktree({ id: 'ready-worktree', status: 'ready' }),
        ],
        {},
        {},
        {}
      )
    ).toBe(true)

    expect(
      projectHasLoadingWorktree(
        [makeWorktree({ id: 'ready-worktree', status: 'ready' })],
        { 'ready-worktree': 'pull' },
        {},
        {}
      )
    ).toBe(true)

    expect(
      projectHasLoadingWorktree(
        [makeWorktree({ id: 'busy-worktree', status: 'ready' })],
        {},
        { 'session-1': true },
        { 'session-1': 'busy-worktree' }
      )
    ).toBe(true)

    expect(
      projectHasLoadingWorktree(
        [makeWorktree({ id: 'idle-worktree', status: 'ready' })],
        {},
        {},
        {}
      )
    ).toBe(false)
  })

  it('aggregates project terminal running and failed state', () => {
    expect(
      getProjectTerminalState(
        [
          makeWorktree({ id: 'worktree-1' }),
          makeWorktree({ id: 'worktree-2' }),
        ],
        {
          'worktree-1': [makeTerminal({ id: 'terminal-running' })],
          'worktree-2': [
            makeTerminal({ id: 'terminal-failed', worktreeId: 'worktree-2' }),
          ],
        },
        new Set(['terminal-running']),
        new Set(['terminal-failed'])
      )
    ).toEqual({
      hasRunningTerminal: true,
      hasFailedTerminal: true,
    })
  })
})
