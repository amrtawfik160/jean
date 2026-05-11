import type React from 'react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { isLinux, isMacOS, openExternal } from '@/lib/platform'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUIStore } from '@/store/ui-store'
import { useCommandContext } from '@/lib/commands'
import {
  ArrowUpCircle,
  Github,
  Heart,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Settings,
} from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePreferences } from '@/services/preferences'
import { formatShortcutDisplay, DEFAULT_KEYBINDINGS } from '@/types/keybindings'
import { isNativeApp } from '@/lib/environment'
import { UnreadBell } from '@/components/unread/UnreadBell'
import { useIsMobile } from '@/hooks/use-mobile'
import { FALLBACK_APP_VERSION } from '@/lib/app-version'
import { LinuxWindowControls } from './LinuxWindowControls'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'

interface TitleBarProps {
  className?: string
  title?: string
  hideTitle?: boolean
}

export function TitleBar({
  className,
  title = 'Jean',
  hideTitle = false,
}: TitleBarProps) {
  const leftSidebarVisible = useUIStore(s => s.leftSidebarVisible)
  const leftSidebarCollapsed = useUIStore(s => s.leftSidebarCollapsed)
  const cycleLeftSidebar = useUIStore(s => s.cycleLeftSidebar)
  const rightSidebarVisible = useUIStore(s => s.rightSidebarVisible)
  const setRightSidebarVisible = useUIStore(s => s.setRightSidebarVisible)

  const sidebarState = !leftSidebarVisible
    ? 'hidden'
    : leftSidebarCollapsed
      ? 'rail'
      : 'expanded'
  const sidebarStateLabel: Record<typeof sidebarState, string> = {
    expanded: 'Expanded',
    rail: 'Rail (icon-only)',
    hidden: 'Hidden',
  }
  const nextSidebarStateLabel: Record<typeof sidebarState, string> = {
    expanded: 'Rail',
    rail: 'Hide',
    hidden: 'Expand',
  }
  const commandContext = useCommandContext()
  const { data: preferences } = usePreferences()
  const isMobile = useIsMobile()

  const sidebarShortcut = formatShortcutDisplay(
    (preferences?.keybindings?.toggle_left_sidebar ||
      DEFAULT_KEYBINDINGS.toggle_left_sidebar) as string
  )
  const native = isNativeApp()

  const [appVersion, setAppVersion] = useState<string>(FALLBACK_APP_VERSION)
  useEffect(() => {
    if (!native) return

    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then(setAppVersion)
      .catch(() => setAppVersion(FALLBACK_APP_VERSION))
  }, [native])

  return (
    <div
      {...(native ? { 'data-tauri-drag-region': true } : {})}
      className={cn(
        'relative flex h-8 w-full shrink-0 items-center justify-between',
        'bg-background/85 backdrop-blur-xl border-b border-border/40 md:px-2',
        native ? 'z-[60]' : 'z-50',
        className
      )}
    >
      {/* Left side - Window Controls + Left Actions */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Left Action Buttons */}
        <div
          className={cn(
            'relative z-10 flex items-center gap-1 pt-1',
            native && isMacOS ? 'pl-[80px]' : 'pl-2'
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={cycleLeftSidebar}
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 rounded-md hover:bg-accent/60',
                  sidebarState === 'hidden'
                    ? 'text-foreground/60 hover:text-foreground'
                    : 'text-foreground hover:text-foreground'
                )}
              >
                {sidebarState === 'expanded' ? (
                  <PanelLeftClose className="size-3.5" />
                ) : (
                  <PanelLeft className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Sidebar: {sidebarStateLabel[sidebarState]} — click for{' '}
              {nextSidebarStateLabel[sidebarState]}{' '}
              <kbd className="ml-1 text-[0.625rem] opacity-60">
                {sidebarShortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={commandContext.openPreferences}
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-foreground/60 hover:text-foreground hover:bg-accent/60"
              >
                <Settings className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Settings{' '}
              <kbd className="ml-1 text-[0.625rem] opacity-60">
                {formatShortcutDisplay(
                  (preferences?.keybindings?.open_preferences ||
                    DEFAULT_KEYBINDINGS.open_preferences) as string
                )}
              </kbd>
            </TooltipContent>
          </Tooltip>
          {!isMobile && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md text-foreground/60 hover:text-foreground hover:bg-accent/60"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() =>
                    openExternal('https://github.com/coollabsio/jean')
                  }
                >
                  <Github className="mr-2 size-3.5" />
                  GitHub
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openExternal('https://jean.build')}
                >
                  <ArrowUpCircle className="mr-2 size-3.5" />
                  Website
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openExternal('https://jean.build/sponsorships/')}
                  className="text-pink-500 focus:text-pink-400"
                >
                  <Heart className="mr-2 size-3.5" />
                  Sponsor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Center - Breadcrumb + unread bell */}
      {!isMobile ? (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex max-w-[60%] items-center gap-2 px-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <BreadcrumbBar />
          <UnreadBell title="" hideTitle />
        </div>
      ) : (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[50%] px-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <UnreadBell title={title} hideTitle={hideTitle} />
        </div>
      )}

      {/* Right side - Version + Windows/Linux window controls */}
      <div
        className={cn('flex items-center pt-1', isMobile && 'pr-2')}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() =>
                  openExternal('https://github.com/coollabsio/jean')
                }
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-foreground/60 hover:text-foreground hover:bg-accent/60"
              >
                <Github className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>GitHub</TooltipContent>
          </Tooltip>
        )}
        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setRightSidebarVisible(!rightSidebarVisible)}
                variant="ghost"
                size="icon"
                className={cn(
                  'mr-1 h-6 w-6 rounded-md hover:bg-accent/60',
                  rightSidebarVisible
                    ? 'text-primary hover:text-primary'
                    : 'text-foreground/60 hover:text-foreground'
                )}
              >
                <PanelRight className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {rightSidebarVisible ? 'Hide' : 'Show'} context rail{' '}
              <kbd className="ml-1 text-[0.625rem] opacity-60">
                {formatShortcutDisplay(
                  (preferences?.keybindings?.toggle_right_sidebar ||
                    DEFAULT_KEYBINDINGS.toggle_right_sidebar) as string
                )}
              </kbd>
            </TooltipContent>
          </Tooltip>
        )}
        {appVersion && <UpdateIndicator />}
        {appVersion && (
          <button
            onClick={() =>
              openExternal(
                `https://github.com/coollabsio/jean/releases/tag/v${appVersion}`
              )
            }
            className="px-1.5 text-[0.625rem] text-foreground/40 transition-colors cursor-pointer hover:text-foreground/60"
          >
            v{appVersion}
          </button>
        )}
        {native && isLinux && <LinuxWindowControls />}
      </div>
    </div>
  )
}

function UpdateIndicator() {
  const pendingVersion = useUIStore(state => state.pendingUpdateVersion)
  if (!pendingVersion) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() =>
            window.dispatchEvent(new Event('install-pending-update'))
          }
          className="mr-1.5 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[0.625rem] font-medium text-primary border border-primary/30 hover:bg-primary/25 transition-colors cursor-pointer"
        >
          <ArrowUpCircle className="size-3.5" />
          Update available
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Update to v{pendingVersion}</TooltipContent>
    </Tooltip>
  )
}

export default TitleBar
