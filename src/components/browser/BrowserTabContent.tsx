import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { browserBackend } from '@/hooks/useBrowserPane'
import { useBrowserStore } from '@/store/browser-store'
import { isNativeApp } from '@/lib/environment'
import {
  CUSTOM_PRESET_ID,
  getPreset,
  isResponsive,
  RESPONSIVE_PRESET_ID,
} from './device-presets'

interface BrowserTabContentProps {
  tabId: string
  /** Active tab is shown; inactive tabs are hidden via webview.hide() */
  isActive: boolean
  /** Bumps when surface layout changes (dock side, drawer mode) so the
   * stable-frame detector reruns and webview re-anchors to new placeholder
   * position. ResizeObserver doesn't fire on transform/portal moves. */
  relayoutNonce?: string | number
}

/** Distance from the document top required for the webview to clear the
 * macOS overlay title bar / TitleBar component. */
const TOP_SAFETY = 0

/** Off-screen parking spot for inactive tab webviews. WKWebView's hide() on
 * a child webview doesn't reliably stop pixels from compositing — a sibling
 * at the same bounds can bleed through. Parking inactive webviews far
 * off-screen guarantees only the active one paints over the visible pane. */
const OFFSCREEN_BOUNDS = { x: -100000, y: -100000, width: 1, height: 1 }

/**
 * Renders an empty placeholder div whose bounding rect drives the position of
 * the underlying native child Webview. The webview itself lives in Rust.
 *
 * Lifecycle:
 *   1. On mount: read the persisted URL for this tab, call `browser_create`.
 *      If the backend already has a webview for this tab_id (recreation after
 *      navigation between worktrees), `browser_set_bounds` instead.
 *   2. ResizeObserver + window resize → debounced rAF → `browser_set_bounds`.
 *   3. Active flag flips → `browser_set_visible`.
 *   4. On unmount: hide (do NOT close — keeps history when re-mounted).
 */
export const BrowserTabContent = memo(function BrowserTabContent({
  tabId,
  isActive,
  relayoutNonce,
}: BrowserTabContentProps) {
  const placeholderRef = useRef<HTMLDivElement>(null)
  const lastBoundsRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const initializedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  // Mirror isActive for closures (flushBounds, ResizeObserver) — when inactive,
  // they must not push real bounds and undo our off-screen parking.
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // Read URL once at mount (subsequent updates handled by Rust → React events)
  const initialUrl = useBrowserStore(
    state =>
      state.tabs[
        Object.keys(state.tabs).find(wid =>
          state.tabs[wid]?.some(t => t.id === tabId)
        ) ?? ''
      ]?.find(t => t.id === tabId)?.url ?? ''
  )

  // Device-emulation state. Selecting a preset recreates the webview to pick
  // up the new user agent — see effect below.
  const presetId = useBrowserStore(
    state => state.devicePresetByTab[tabId] ?? RESPONSIVE_PRESET_ID
  )
  const customSize = useBrowserStore(state => state.customSizeByTab[tabId])
  const preset = getPreset(presetId)
  const isCustom = presetId === CUSTOM_PRESET_ID
  const responsive = isResponsive(presetId)
  const effectiveWidth = responsive
    ? null
    : isCustom
      ? (customSize?.width ?? null)
      : preset.width
  const effectiveHeight = responsive
    ? null
    : isCustom
      ? (customSize?.height ?? null)
      : preset.height
  const effectiveUa = preset.userAgent

  // Re-create the underlying webview whenever the UA changes (preset switch).
  // We can't mutate UA on a live webview — Tauri sets it at builder time only.
  const lastAppliedUaRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!isNativeApp()) return
    if (!initializedRef.current) {
      lastAppliedUaRef.current = effectiveUa
      return
    }
    if (lastAppliedUaRef.current === effectiveUa) return
    lastAppliedUaRef.current = effectiveUa
    let cancelled = false
    void (async () => {
      try {
        // Preserve the current page across UA swap.
        let currentUrl = initialUrl
        try {
          currentUrl = await browserBackend.getUrl(tabId)
        } catch {
          // ignore; fall back to initialUrl
        }
        await browserBackend.close(tabId)
        if (cancelled) return
        initializedRef.current = false
        const next = measure()
        if (next && currentUrl) {
          await browserBackend.create(tabId, currentUrl, next, effectiveUa)
          initializedRef.current = true
          lastBoundsRef.current = next
          if (isActiveRef.current) {
            await browserBackend.setVisible(tabId, true)
          }
        }
      } catch (err) {
        console.error('[browser] UA recreate failed:', err)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUa, tabId])

  // Returns PHYSICAL pixels. Rust side uses PhysicalPosition/PhysicalSize
  // because Tauri's scale_factor() can disagree with WKWebView's
  // window.devicePixelRatio under fractional macOS display scaling
  // ("More Space" modes on Retina). Sending physical bypasses the conversion.
  const measure = (): {
    x: number
    y: number
    width: number
    height: number
  } | null => {
    const el = placeholderRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    return {
      x: Math.round(rect.left * dpr),
      y: Math.round(Math.max(rect.top, TOP_SAFETY) * dpr),
      width: Math.round(Math.max(rect.width, 1) * dpr),
      height: Math.round(Math.max(rect.height, 1) * dpr),
    }
  }

  const flushBounds = (): void => {
    if (!initializedRef.current) return
    if (!isActiveRef.current) return
    const next = measure()
    if (!next) return
    const prev = lastBoundsRef.current
    if (
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
    ) {
      return
    }
    lastBoundsRef.current = next
    void browserBackend.setBounds(tabId, next)
  }

  const scheduleFlush = (): void => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      flushBounds()
    })
  }

  // Mount + relayout: poll bounds via rAF until stable for 2 consecutive
  // frames (handles Sheet slide-in / dock-side switches / other
  // ResizeObserver-blind ancestor transforms). Webview hides during the
  // detect phase, then commits final position in one shot.
  useLayoutEffect(() => {
    let cancelled = false
    let rafId: number | null = null
    let stableFrames = 0
    let candidate: ReturnType<typeof measure> = null
    const STABLE_FRAMES_REQUIRED = 2
    const MAX_FRAMES = 60 // ~1s safety cap

    // For a relayout (post-init), hide the webview while the new position
    // settles to avoid showing it briefly at the old coords.
    if (initializedRef.current) {
      void browserBackend.setVisible(tabId, false)
    }

    let frameCount = 0
    const tick = async () => {
      if (cancelled) return
      frameCount++
      const next = measure()
      if (!next) {
        rafId = requestAnimationFrame(() => void tick())
        return
      }
      if (
        candidate &&
        candidate.x === next.x &&
        candidate.y === next.y &&
        candidate.width === next.width &&
        candidate.height === next.height
      ) {
        stableFrames++
      } else {
        candidate = next
        stableFrames = 1
      }
      if (stableFrames >= STABLE_FRAMES_REQUIRED || frameCount >= MAX_FRAMES) {
        await commit(next)
        return
      }
      rafId = requestAnimationFrame(() => void tick())
    }

    const commit = async (bounds: NonNullable<ReturnType<typeof measure>>) => {
      if (cancelled) return
      const exists = await browserBackend.hasActive(tabId)
      if (cancelled) return
      lastBoundsRef.current = bounds
      try {
        if (exists) {
          await browserBackend.setBounds(tabId, bounds)
        } else if (initialUrl) {
          await browserBackend.create(tabId, initialUrl, bounds, effectiveUa)
        }
        lastAppliedUaRef.current = effectiveUa
        initializedRef.current = true
        if (isActive) {
          await browserBackend.setVisible(tabId, true)
        }
      } catch (err) {
        console.error(`[browser] init failed for tab ${tabId}:`, err)
      }
    }

    rafId = requestAnimationFrame(() => void tick())

    return () => {
      cancelled = true
      if (rafId != null) cancelAnimationFrame(rafId)
    }
    // initialUrl is read once at mount; subsequent URL changes flow through
    // Rust → React events which update the store but should not re-create
    // the webview. Intentionally omit it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, relayoutNonce])

  // Track placeholder size + window resize → push new bounds
  useEffect(() => {
    const el = placeholderRef.current
    if (!el) return
    const observer = new ResizeObserver(() => scheduleFlush())
    observer.observe(el)
    window.addEventListener('resize', scheduleFlush)
    window.addEventListener('scroll', scheduleFlush, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleFlush)
      window.removeEventListener('scroll', scheduleFlush, true)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle visibility on active flip. Inactive tabs are parked off-screen
  // (in addition to webview.hide()) so a hide() that fails to stop pixel
  // composition can't leak the previous tab's content over the active one.
  useEffect(() => {
    if (!initializedRef.current) return
    if (isActive) {
      const next = measure()
      if (next) {
        lastBoundsRef.current = next
        void browserBackend.setBounds(tabId, next)
      }
      void browserBackend.setVisible(tabId, true)
      // Re-measure after pane reveal in case layout changed while hidden
      scheduleFlush()
    } else {
      void browserBackend.setBounds(tabId, OFFSCREEN_BOUNDS)
      lastBoundsRef.current = OFFSCREEN_BOUNDS
      void browserBackend.setVisible(tabId, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, tabId])

  // On unmount: park off-screen + hide (keeps webview alive in Rust for re-mount)
  useEffect(() => {
    return () => {
      void browserBackend.setBounds(tabId, OFFSCREEN_BOUNDS)
      void browserBackend.setVisible(tabId, false)
    }
  }, [tabId])

  // Listen for display scale changes (window dragged to different-DPI screen).
  // JS resize events don't always fire on pure DPR changes, but Tauri's
  // onScaleChanged does. Re-flush so bounds re-measure under new dpr.
  useEffect(() => {
    if (!isNativeApp()) return
    const win = getCurrentWindow()
    let unlisten: (() => void) | null = null
    void win
      .onScaleChanged(() => scheduleFlush())
      .then(fn => {
        unlisten = fn
      })
    return () => {
      if (unlisten) unlisten()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When a device preset is active, the webview is sized to the preset and
  // centered inside a darker pane so the user sees a "device window". The
  // placeholder still drives the webview bounds — ResizeObserver fires when
  // the window resizes (the wrapper caps the placeholder to the preset).
  if (effectiveWidth && effectiveHeight) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-auto bg-muted/40 p-3">
        <div
          ref={placeholderRef}
          className="rounded-md shadow-lg ring-1 ring-border bg-background"
          style={{
            width: `${effectiveWidth}px`,
            height: `${effectiveHeight}px`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          data-browser-tab-id={tabId}
        />
      </div>
    )
  }

  return (
    <div
      ref={placeholderRef}
      className="relative h-full w-full"
      data-browser-tab-id={tabId}
    />
  )
})
