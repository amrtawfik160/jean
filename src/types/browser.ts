/**
 * Types for the embedded browser pane (per-worktree multi-tab native webview).
 * Mirror Rust event payload shapes from src-tauri/src/browser/types.rs
 */

export type ModalBrowserDockMode = 'floating' | 'left' | 'right' | 'bottom'

export interface BrowserTab {
  id: string
  worktreeId: string
  url: string
  title: string
  isLoading: boolean
  /** Set when load fails / times out. Cleared on next successful navigation. */
  error?: string | null
  /** What the user asked to load. Set in navigate(); cleared on browser:loaded resolution. */
  requestedUrl?: string | null
  /** Last URL that successfully reached browser:loaded. Used to detect WKWebView fallback-to-previous on failed nav. */
  lastLoadedUrl?: string | null
}

// Rust → React event payloads (camelCase via serde rename_all)
export interface BrowserPageLoadEvent {
  tabId: string
  url: string
}

export interface BrowserNavEvent {
  tabId: string
  url: string
}

export interface BrowserTitleEvent {
  tabId: string
  title: string
}

export interface BrowserClosedEvent {
  tabId: string
}

/** Bounds passed to browser_create / browser_set_bounds (logical pixels). */
export interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Device viewport preset for responsive emulation. Width/height/dpr in CSS px. */
export interface DevicePreset {
  id: string
  label: string
  /** null for Responsive / Custom (with user-supplied values stored elsewhere). */
  width: number | null
  height: number | null
  dpr: number | null
  /** UA string applied at webview create time; null = inherit system default. */
  userAgent: string | null
  category: 'phone' | 'tablet' | 'desktop'
}

/** User-supplied dimensions when the Custom preset is selected. */
export interface CustomDeviceSize {
  width: number
  height: number
  dpr: number
}

/** Result of an inspector pick — sent from page → Rust → React via event. */
export interface ElementSelection {
  tabId: string
  tagName: string
  id: string
  className: string
  cssSelector: string
  outerHtml: string
  textContent: string
  computedStyles: Record<string, string>
  boundingRect: { x: number; y: number; width: number; height: number }
  pageUrl: string
}

/** Emitted by Rust when a capture finishes. */
export interface BrowserScreenshotSavedEvent {
  tabId: string
  path: string
  origin: 'visible' | 'full-page'
}

export type ScreenshotOrigin = 'visible' | 'full-page'

/** Single drawn primitive in the annotation canvas. */
export type AnnotationTool = 'pen' | 'rect' | 'arrow' | 'text'

export interface AnnotationStroke {
  tool: AnnotationTool
  color: string
  width: number
  /** For pen: full polyline; for rect/arrow: [start, end]; for text: [position]. */
  points: { x: number; y: number }[]
  text?: string
}
