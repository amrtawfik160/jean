import { useMemo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  BackendLabel,
  getBackendPlainLabel,
} from '@/components/ui/backend-label'
import { ClaudeIcon } from '@/components/icons/ClaudeIcon'
import { CodexIcon } from '@/components/icons/CodexIcon'
import { OpenCodeIcon } from '@/components/icons/OpenCodeIcon'
import { CursorIcon } from '@/components/icons/CursorIcon'
import {
  CODEX_MODEL_OPTIONS,
  CURSOR_MODEL_OPTIONS,
  EFFORT_LEVEL_OPTIONS,
  MODEL_OPTIONS,
  OPENCODE_MODEL_OPTIONS,
} from '@/components/chat/toolbar/toolbar-options'
import { CheckIcon } from '@/components/icons'
import type { CliBackend } from '@/types/preferences'
import type { EffortLevel } from '@/types/chat'

export interface PlanExecutionOverride {
  backend: CliBackend
  model: string
  effortLevel?: EffortLevel
}

interface Props {
  installedBackends: CliBackend[]
  value: PlanExecutionOverride
  onChange: (next: PlanExecutionOverride) => void
  disabled?: boolean
}

function getModelOptions(backend: CliBackend) {
  switch (backend) {
    case 'claude':
      return MODEL_OPTIONS
    case 'codex':
      return CODEX_MODEL_OPTIONS
    case 'opencode':
      return OPENCODE_MODEL_OPTIONS
    case 'cursor':
      return CURSOR_MODEL_OPTIONS
  }
}

function defaultModelFor(backend: CliBackend): string {
  return getModelOptions(backend)[0]?.value ?? ''
}

function backendSupportsEffort(backend: CliBackend): boolean {
  return backend === 'codex' || backend === 'claude'
}

function BackendIconTriggerSlot({ backend }: { backend: CliBackend }) {
  switch (backend) {
    case 'claude':
      return <ClaudeIcon className="h-3.5 w-3.5" />
    case 'codex':
      return <CodexIcon className="h-3.5 w-3.5" />
    case 'opencode':
      return <OpenCodeIcon className="h-3.5 w-3.5" />
    case 'cursor':
      return <CursorIcon className="h-3.5 w-3.5" />
  }
}

export function PlanExecutionPicker({
  installedBackends,
  value,
  onChange,
  disabled,
}: Props) {
  const backends =
    installedBackends.length > 0
      ? installedBackends
      : (['claude'] as CliBackend[])

  const modelOptions = useMemo(
    () => getModelOptions(value.backend),
    [value.backend]
  )
  const modelLabel =
    modelOptions.find(o => o.value === value.model)?.label ?? value.model
  const effortLabel = value.effortLevel
    ? (EFFORT_LEVEL_OPTIONS.find(o => o.value === value.effortLevel)?.label ??
      value.effortLevel)
    : null

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">Execute with:</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-7 gap-1.5 px-2"
          >
            <BackendIconTriggerSlot backend={value.backend} />
            <BackendLabel backend={value.backend} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Backend</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {backends.map(b => {
            const isActive = b === value.backend
            return (
              <DropdownMenuItem
                key={b}
                onClick={() => {
                  if (b === value.backend) return
                  onChange({
                    backend: b,
                    model: defaultModelFor(b),
                    effortLevel: backendSupportsEffort(b)
                      ? value.effortLevel
                      : undefined,
                  })
                }}
              >
                <BackendIconTriggerSlot backend={b} />
                <span>{getBackendPlainLabel(b)}</span>
                {isActive && <CheckIcon className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || modelOptions.length <= 1}
            className="h-7 gap-1.5 px-2"
          >
            {modelLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {modelOptions.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange({ ...value, model: opt.value })}
            >
              <span>{opt.label}</span>
              {opt.value === value.model && (
                <CheckIcon className="ml-auto h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {backendSupportsEffort(value.backend) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-7 gap-1.5 px-2"
            >
              {effortLabel ?? 'Effort'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Effort</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EFFORT_LEVEL_OPTIONS.map(opt => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onChange({ ...value, effortLevel: opt.value })}
              >
                <span>{opt.label}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {opt.description}
                </span>
                {opt.value === value.effortLevel && (
                  <CheckIcon className="ml-auto h-3.5 w-3.5" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function defaultPlanExecutionOverride(
  backend: CliBackend
): PlanExecutionOverride {
  return {
    backend,
    model: defaultModelFor(backend),
    effortLevel: backendSupportsEffort(backend) ? 'high' : undefined,
  }
}
