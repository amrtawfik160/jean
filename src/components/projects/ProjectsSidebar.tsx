import { useEffect, useState } from 'react'
import { Plus, Folder, Archive, Briefcase } from '@/components/icons'
import { convertFileSrc } from '@/lib/transport'
import { cn } from '@/lib/utils'
import { useSidebarWidth } from '@/components/layout/SidebarWidthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useProjects,
  useCreateFolder,
  useAppDataDir,
} from '@/services/projects'
// useAppDataDir is referenced by RailSidebar below.
import { useProjectsStore } from '@/store/projects-store'
import { useChatStore } from '@/store/chat-store'
import { ProjectTree } from './ProjectTree'
import { useInstalledBackends } from '@/hooks/useInstalledBackends'
import { scheduleIdleWork } from '@/lib/idle'
import { isFolder } from '@/types/projects'

const RAIL_THRESHOLD = 80

export function ProjectsSidebar() {
  const { data: projects = [], isLoading } = useProjects()
  const { setAddProjectDialogOpen } = useProjectsStore()
  const createFolder = useCreateFolder()
  const sidebarWidth = useSidebarWidth()
  const [backendCheckReady, setBackendCheckReady] = useState(false)
  useEffect(() => scheduleIdleWork(() => setBackendCheckReady(true), 1500), [])
  const { installedBackends } = useInstalledBackends({
    enabled: backendCheckReady,
  })
  const setupIncomplete = installedBackends.length === 0

  const isRailMode = sidebarWidth <= RAIL_THRESHOLD
  const isNarrow = sidebarWidth < 180

  if (isRailMode) {
    return <RailSidebar />
  }

  return (
    <div className="flex h-full flex-col">
      {/* Linear-style sidebar header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-sidebar-border/60 px-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
          Projects
        </span>
        <span className="rounded-md bg-sidebar-accent/40 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/70">
          {projects.filter(p => !p.is_folder).length}
        </span>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-full items-center justify-center px-2">
            <span className="truncate text-xs text-muted-foreground/60">
              No projects found
            </span>
          </div>
        ) : (
          <ProjectTree projects={projects} />
        )}
      </div>

      {/* Footer — Linear-style ghost row */}
      <div
        className={`flex gap-1 border-t border-sidebar-border p-1.5 ${isNarrow ? 'flex-col' : 'items-center'}`}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {!isNarrow && <Plus className="size-3" />}
              New
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            style={{ width: sidebarWidth - 12 }}
          >
            <DropdownMenuItem
              onClick={() => createFolder.mutate({ name: 'New Folder' })}
            >
              <Folder className="mr-2 size-3.5" />
              Folder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setAddProjectDialogOpen(true)}
              disabled={!backendCheckReady || setupIncomplete}
            >
              <Briefcase className="mr-2 size-3.5" />
              Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('command:open-archived-modal'))
          }
        >
          {!isNarrow && <Archive className="size-3" />}
          Archived
        </button>
      </div>
    </div>
  )
}

/**
 * Icon-only rail mode — 48px wide, shows project avatars stacked vertically.
 * Selected project gets the indigo accent rail. Hover surfaces project name
 * via tooltip. Footer keeps Plus + Archive as icon buttons.
 */
function RailSidebar() {
  const { data: projects = [] } = useProjects()
  const { data: appDataDir = '' } = useAppDataDir()
  const selectedProjectId = useProjectsStore(s => s.selectedProjectId)
  const activeWorktreeId = useChatStore(s => s.activeWorktreeId)
  const setAddProjectDialogOpen = useProjectsStore(
    s => s.setAddProjectDialogOpen
  )
  const realProjects = projects.filter(p => !isFolder(p))

  const handleProjectClick = (projectId: string) => {
    useChatStore.getState().clearActiveWorktree()
    useProjectsStore.getState().selectProject(projectId)
  }

  return (
    <div className="flex h-full w-full flex-col items-center">
      {/* Header — count chip */}
      <div className="flex h-9 w-full shrink-0 items-center justify-center border-b border-sidebar-border/60">
        <span className="rounded-md bg-sidebar-accent/40 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/80">
          {realProjects.length}
        </span>
      </div>

      {/* Project avatars */}
      <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-1.5">
        <div className="flex flex-col items-center gap-1">
          {realProjects.map(project => {
            const isSelected =
              selectedProjectId === project.id && !activeWorktreeId
            const avatarUrl =
              project.avatar_path && appDataDir
                ? convertFileSrc(`${appDataDir}/${project.avatar_path}`)
                : null

            return (
              <Tooltip key={project.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleProjectClick(project.id)}
                    className={cn(
                      'group relative flex size-8 items-center justify-center rounded-md transition-all duration-150',
                      'hover:bg-sidebar-accent',
                      isSelected && 'bg-sidebar-accent shadow-[inset_0_0_0_1px_oklch(0.66_0.19_268/0.4)]'
                    )}
                    aria-label={project.name}
                  >
                    {isSelected && (
                      <span className="absolute -left-1.5 top-1.5 bottom-1.5 w-[2px] rounded-r bg-primary" />
                    )}
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="size-5 rounded-sm object-cover"
                      />
                    ) : (
                      <div className="flex size-5 items-center justify-center rounded-sm bg-muted-foreground/20 text-[10px] font-medium uppercase">
                        {project.name[0]}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{project.name}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>

      {/* Footer — icon buttons */}
      <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-sidebar-border p-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAddProjectDialogOpen(true)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Add project"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Add project</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('command:open-archived-modal')
                )
              }
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Archived"
            >
              <Archive className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Archived</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
