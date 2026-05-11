import { useEffect, useState } from 'react'
import { Plus, Folder, Archive, Briefcase } from '@/components/icons'
import { useSidebarWidth } from '@/components/layout/SidebarWidthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProjects, useCreateFolder } from '@/services/projects'
import { useProjectsStore } from '@/store/projects-store'
import { ProjectTree } from './ProjectTree'
import { useInstalledBackends } from '@/hooks/useInstalledBackends'
import { scheduleIdleWork } from '@/lib/idle'

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

  // Responsive layout threshold
  const isNarrow = sidebarWidth < 180

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
