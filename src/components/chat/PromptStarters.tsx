import { memo } from 'react'
import { Bug, Sparkles, FileText, GitPullRequest } from '@/components/icons'

export interface PromptStarter {
  id: string
  label: string
  description: string
  template: string
  icon: typeof Bug
}

export const PROMPT_STARTERS: PromptStarter[] = [
  {
    id: 'plan-feature',
    label: 'Plan a feature',
    description: 'Outline a small feature end-to-end before coding',
    template:
      "Plan how we'd add the following feature. Surface trade-offs, list files to touch, and propose a minimal implementation. Feature: ",
    icon: Sparkles,
  },
  {
    id: 'investigate-bug',
    label: 'Investigate a bug',
    description: 'Reproduce, root-cause, and propose a fix',
    template:
      'Investigate this bug. Trace through the code, find the root cause, and propose a minimal fix. Bug: ',
    icon: Bug,
  },
  {
    id: 'review-pr',
    label: 'Review this PR',
    description: 'Run a focused code review on the current branch',
    template:
      'Review the changes on the current branch. Highlight bugs, regressions, and risky patterns. Cite file:line for each finding.',
    icon: GitPullRequest,
  },
  {
    id: 'refactor-file',
    label: 'Refactor a file',
    description: 'Suggest a focused refactor with minimal blast radius',
    template:
      'Refactor the following file to improve readability without changing behavior. Keep the diff small. File: ',
    icon: FileText,
  },
]

interface Props {
  onPick: (template: string) => void
}

export const PromptStarters = memo(function PromptStarters({ onPick }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 px-4 md:px-6 pb-3">
      {PROMPT_STARTERS.map(s => {
        const Icon = s.icon
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.template)}
            className="glass-quiet text-left rounded-lg px-3 py-2 transition-colors hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {s.label}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {s.description}
            </div>
          </button>
        )
      })}
    </div>
  )
})
