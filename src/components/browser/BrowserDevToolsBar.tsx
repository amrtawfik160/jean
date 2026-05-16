import { memo, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { invoke } from '@/lib/transport'
import { isNativeApp } from '@/lib/environment'
import {
  Camera,
  ChevronDown,
  Crosshair,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Wrench,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useBrowserStore } from '@/store/browser-store'
import {
  CUSTOM_PRESET_ID,
  DEVICE_PRESETS,
  getPreset,
  isResponsive,
  RESPONSIVE_PRESET_ID,
} from './device-presets'
import { CustomDeviceSizePopover } from './CustomDeviceSizePopover'

interface BrowserDevToolsBarProps {
  worktreeId: string
  className?: string
}

function presetIcon(category: 'phone' | 'tablet' | 'desktop') {
  if (category === 'phone') return Smartphone
  if (category === 'tablet') return Tablet
  return Monitor
}

export const BrowserDevToolsBar = memo(function BrowserDevToolsBar({
  worktreeId,
  className,
}: BrowserDevToolsBarProps) {
  const activeTabId = useBrowserStore(
    state => state.activeTabIds[worktreeId] ?? ''
  )
  const presetId = useBrowserStore(
    state => state.devicePresetByTab[activeTabId] ?? RESPONSIVE_PRESET_ID
  )
  const inspecting = useBrowserStore(
    state => state.inspectModeByTab[activeTabId] ?? false
  )

  const [devtoolsAvailable, setDevtoolsAvailable] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return
    let cancelled = false
    void invoke<boolean>('browser_devtools_available')
      .then(v => {
        if (!cancelled) setDevtoolsAvailable(v)
      })
      .catch(() => {
        if (!cancelled) setDevtoolsAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCapture = useCallback(
    async (origin: 'visible' | 'full-page') => {
      if (!activeTabId || !isNativeApp()) return
      const toastId = toast.loading(
        origin === 'visible'
          ? 'Capturing viewport…'
          : 'Capturing full page (scroll-and-stitch)…'
      )
      try {
        await invoke<string>(
          origin === 'visible'
            ? 'browser_capture_visible'
            : 'browser_capture_full_page',
          { tabId: activeTabId }
        )
        // The Rust side emits browser:screenshot-saved → the annotation modal
        // opens via useBrowserScreenshots. Dismiss the loading toast quietly.
        toast.dismiss(toastId)
      } catch (err) {
        toast.error(`Screenshot failed: ${String(err)}`, { id: toastId })
      }
    },
    [activeTabId]
  )

  const handleToggleInspect = useCallback(async () => {
    if (!activeTabId || !isNativeApp()) return
    const next = !inspecting
    useBrowserStore.getState().setInspectMode(activeTabId, next)
    try {
      await invoke(
        next ? 'browser_enter_inspect_mode' : 'browser_exit_inspect_mode',
        { tabId: activeTabId }
      )
      if (next) {
        toast.info('Inspector on — click an element. Esc to cancel.')
      }
    } catch (err) {
      toast.error(`Inspector failed: ${String(err)}`)
      useBrowserStore.getState().setInspectMode(activeTabId, false)
    }
  }, [activeTabId, inspecting])

  const handleSelectPreset = useCallback(
    (id: string) => {
      if (!activeTabId) return
      if (id === CUSTOM_PRESET_ID) {
        useBrowserStore.getState().setDevicePreset(activeTabId, id)
        setCustomOpen(true)
        return
      }
      useBrowserStore.getState().setDevicePreset(activeTabId, id)
    },
    [activeTabId]
  )

  const handleOpenDevTools = useCallback(async () => {
    if (!activeTabId || !isNativeApp()) return
    try {
      await invoke('browser_open_devtools', { tabId: activeTabId })
    } catch (err) {
      toast.error(`DevTools unavailable: ${String(err)}`)
    }
  }, [activeTabId])

  const currentPreset = getPreset(presetId)
  const PresetIcon = isResponsive(presetId)
    ? Globe
    : presetIcon(currentPreset.category)
  const disabled = !activeTabId

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 border-b bg-card px-2 py-1',
        className
      )}
    >
      {/* Screenshot */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled}
            aria-label="Capture screenshot"
          >
            <Camera className="h-3.5 w-3.5" />
            Screenshot
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs">Capture</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void handleCapture('visible')}>
            Visible viewport
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleCapture('full-page')}>
            Full page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inspector */}
      <Button
        variant={inspecting ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        disabled={disabled}
        onClick={() => void handleToggleInspect()}
        aria-label={inspecting ? 'Exit inspector' : 'Inspect element'}
      >
        <Crosshair className="h-3.5 w-3.5" />
        Inspect
      </Button>

      <div className="ml-1 h-4 w-px bg-border" />

      {/* Device preset */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled}
            aria-label="Device preset"
          >
            <PresetIcon className="h-3.5 w-3.5" />
            {currentPreset.label}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Device</DropdownMenuLabel>
          {DEVICE_PRESETS.map(p => {
            const Icon =
              p.id === RESPONSIVE_PRESET_ID ? Globe : presetIcon(p.category)
            const dims = p.width && p.height ? `${p.width}×${p.height}` : ''
            return (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => handleSelectPreset(p.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {p.label}
                </span>
                {dims && (
                  <span className="text-[10px] text-muted-foreground">
                    {dims}
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
            Switching presets reloads the tab to apply the new user agent.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>

      {presetId === CUSTOM_PRESET_ID && activeTabId && (
        <CustomDeviceSizePopover
          tabId={activeTabId}
          open={customOpen}
          onOpenChange={setCustomOpen}
        />
      )}

      <div className="ml-auto flex items-center gap-1">
        {devtoolsAvailable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={disabled}
            onClick={() => void handleOpenDevTools()}
            aria-label="Open native DevTools"
            title="Open native WKWebView / WebView2 inspector"
          >
            <Wrench className="h-3.5 w-3.5" />
            DevTools
          </Button>
        )}
      </div>
    </div>
  )
})
