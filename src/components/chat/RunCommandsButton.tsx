import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Package,
  Play,
  Plus,
  Save,
  Settings,
  Trash2,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  normalizeRunScripts,
  useJeanConfig,
  usePackageJsonScripts,
  useSaveJeanConfig,
} from '@/services/projects'
import { toast } from 'sonner'

interface RunCommandsButtonProps {
  projectPath: string | null | undefined
  fallbackRunScripts: string[]
  hasRunningTerminal: boolean
  hasFailedTerminal: boolean
  runShortcut: string
  onRunCommand: (command: string) => void
}

function uniqueCommands(commands: string[]) {
  const seen = new Set<string>()
  const next: string[] = []
  for (const command of commands) {
    const trimmed = command.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    next.push(trimmed)
  }
  return next
}

function commandLabel(command: string) {
  return command.replace(/^bun run /, '')
}

export function RunCommandsButton({
  projectPath,
  fallbackRunScripts,
  hasRunningTerminal,
  hasFailedTerminal,
  runShortcut,
  onRunCommand,
}: RunCommandsButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: jeanConfig } = useJeanConfig(projectPath ?? null)
  const { data: packageScripts = [] } = usePackageJsonScripts(
    projectPath ?? null
  )
  const saveConfig = useSaveJeanConfig()

  const savedRunScripts = normalizeRunScripts(jeanConfig?.scripts.run)
  const commands = useMemo(
    () =>
      uniqueCommands(
        savedRunScripts.length > 0 ? savedRunScripts : fallbackRunScripts
      ),
    [fallbackRunScripts, savedRunScripts]
  )

  const primaryCommand = commands[0]
  const iconClassName = hasFailedTerminal
    ? 'text-red-500'
    : hasRunningTerminal
      ? 'text-amber-500 dark:text-yellow-400 animate-icon-glow'
      : ''

  const handlePrimaryRun = () => {
    if (!primaryCommand) {
      setDialogOpen(true)
      return
    }
    onRunCommand(primaryCommand)
  }

  const tooltipLabel = hasFailedTerminal
    ? 'Crashed'
    : hasRunningTerminal
      ? 'Running'
      : primaryCommand
        ? `Run ${commandLabel(primaryCommand)}`
        : 'Add run commands'

  return (
    <>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2 text-xs',
                commands.length > 1 && 'rounded-r-none'
              )}
              aria-label={primaryCommand ? 'Run command' : 'Add run commands'}
              onClick={handlePrimaryRun}
            >
              <Play className={cn('h-3 w-3', iconClassName)} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {tooltipLabel}{' '}
            <kbd className="ml-1 text-[0.625rem] opacity-60">{runShortcut}</kbd>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 border-l border-border/50 px-1 text-xs',
                commands.length > 1 ? 'rounded-l-none' : 'ml-0.5'
              )}
              aria-label="Choose or edit run commands"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {commands.length > 0 ? (
              commands.map((command, index) => (
                <DropdownMenuItem
                  key={`${command}-${index}`}
                  onSelect={() => onRunCommand(command)}
                  className="gap-2"
                >
                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {command}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No run commands yet.
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
              <Settings className="mr-2 h-3.5 w-3.5" />
              Manage run commands…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RunCommandsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectPath={projectPath ?? null}
        commands={commands}
        packageScripts={packageScripts}
        setupScript={jeanConfig?.scripts.setup ?? null}
        teardownScript={jeanConfig?.scripts.teardown ?? null}
        ports={jeanConfig?.ports ?? null}
        isSaving={saveConfig.isPending}
        onSave={async nextCommands => {
          if (!projectPath) return
          const filtered = uniqueCommands(nextCommands)
          const run =
            filtered.length === 0
              ? null
              : filtered.length === 1
                ? (filtered[0] ?? null)
                : filtered

          await saveConfig.mutateAsync({
            projectPath,
            config: {
              scripts: {
                setup: jeanConfig?.scripts.setup ?? null,
                teardown: jeanConfig?.scripts.teardown ?? null,
                run,
              },
              ports: jeanConfig?.ports ?? null,
            },
          })
          toast.success('Run commands saved')
          setDialogOpen(false)
        }}
      />
    </>
  )
}

function RunCommandsDialog({
  open,
  onOpenChange,
  projectPath,
  commands,
  packageScripts,
  setupScript,
  teardownScript,
  ports,
  isSaving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectPath: string | null
  commands: string[]
  packageScripts: { name: string; command: string; runCommand: string }[]
  setupScript: string | null
  teardownScript: string | null
  ports: { port: number; label: string }[] | null
  isSaving: boolean
  onSave: (commands: string[]) => Promise<void>
}) {
  const [draftCommands, setDraftCommands] = useState<string[]>([''])

  useEffect(() => {
    if (!open) return
    setDraftCommands(commands.length > 0 ? commands : [''])
  }, [commands, open])

  const cleanDraft = uniqueCommands(draftCommands)
  const suggestedScripts = packageScripts.filter(
    script => !cleanDraft.includes(script.runCommand)
  )

  const updateCommand = (index: number, value: string) => {
    setDraftCommands(current => {
      const next = [...current]
      next[index] = value
      return next
    })
  }

  const addCommand = (command = '') => {
    setDraftCommands(current => [...current, command])
  }

  const removeCommand = (index: number) => {
    setDraftCommands(current => {
      const next = current.filter((_, i) => i !== index)
      return next.length > 0 ? next : ['']
    })
  }

  const addSuggestion = (command: string) => {
    setDraftCommands(current => {
      const withoutEmptyTail = current.filter(item => item.trim())
      return uniqueCommands([...withoutEmptyTail, command])
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run commands</DialogTitle>
          <DialogDescription>
            Configure the commands shown in the top-right Run menu for this
            project. Commands are saved to jean.json and run inside the active
            worktree.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-muted-foreground" />
                Suggested from package.json
              </div>
              <span className="text-xs text-muted-foreground">
                {packageScripts.length} found
              </span>
            </div>
            {suggestedScripts.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestedScripts.map(script => (
                  <button
                    key={script.name}
                    type="button"
                    onClick={() => addSuggestion(script.runCommand)}
                    className="group rounded-lg border bg-background/70 p-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        bun run {script.name}
                      </span>
                      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {script.command}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {packageScripts.length > 0
                  ? 'All package.json scripts are already added.'
                  : 'No package.json scripts found for this project.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium">Manual commands</h4>
                <p className="text-xs text-muted-foreground">
                  Add any shell command. Use bun for package scripts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCommand()}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {draftCommands.map((command, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </div>
                  <Input
                    value={command}
                    onChange={event => updateCommand(index, event.target.value)}
                    placeholder="bun run dev"
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCommand(index)}
                    aria-label="Remove command"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground/80">
              jean.json preview
            </div>
            <code className="block whitespace-pre-wrap font-mono">
              {JSON.stringify(
                {
                  scripts: {
                    setup: setupScript,
                    teardown: teardownScript,
                    run:
                      cleanDraft.length === 0
                        ? null
                        : cleanDraft.length === 1
                          ? cleanDraft[0]
                          : cleanDraft,
                  },
                  ports,
                },
                null,
                2
              )}
            </code>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!projectPath || isSaving}
            onClick={() => onSave(draftCommands)}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save commands'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
