import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { listen } from '@/lib/transport'
import { isNativeApp } from '@/lib/environment'
import { useChatStore } from '@/store/chat-store'
import { useBrowserStore } from '@/store/browser-store'
import { getFilename } from '@/lib/path-utils'
import { generateId } from '@/lib/uuid'
import type {
  BrowserScreenshotSavedEvent,
  ElementSelection,
} from '@/types/browser'

interface UseBrowserDevToolsResult {
  /** Path of the most recent capture awaiting annotation, if any. */
  annotateImagePath: string | null
  annotateOpen: boolean
  /** Called by the annotation modal when it closes. */
  setAnnotateOpen: (open: boolean) => void
  /** Called with the saved annotated path (or null on cancel). */
  onAnnotateSaved: (savedPath: string | null) => void
}

/**
 * Wire up Rust → React browser DevTools events:
 *   - `browser:screenshot-saved` → open the annotation modal
 *   - `browser:element-selected` → attach element context to chat input
 *   - `browser:inspector-cancelled` → clear inspector toggle
 *
 * After the user annotates a screenshot and clicks save, the resulting
 * (composited) path is attached to the active session's `pendingImages`,
 * which `ChatInput` already renders as a thumbnail.
 */
export function useBrowserDevTools(
  worktreeId: string
): UseBrowserDevToolsResult {
  const [annotateImagePath, setAnnotateImagePath] = useState<string | null>(
    null
  )
  const [annotateOpen, setAnnotateOpen] = useState(false)

  // Track which tabs belong to this worktree so we only react to relevant tabs.
  const tabIds = useBrowserStore(state => state.tabs[worktreeId] ?? [])
  const tabIdSet = useMemo(() => new Set(tabIds.map(t => t.id)), [tabIds])
  const tabIdSetRef = useRef(tabIdSet)
  // Keep the ref in sync from a layout effect so listener closures see the
  // latest set without resubscribing on every tab add/remove.
  useEffect(() => {
    tabIdSetRef.current = tabIdSet
  }, [tabIdSet])

  useEffect(() => {
    if (!isNativeApp()) return
    const unlistens: Promise<() => void>[] = []

    unlistens.push(
      listen<BrowserScreenshotSavedEvent>('browser:screenshot-saved', e => {
        if (!tabIdSetRef.current.has(e.payload.tabId)) return
        setAnnotateImagePath(e.payload.path)
        setAnnotateOpen(true)
      })
    )

    unlistens.push(
      listen<ElementSelection>('browser:element-selected', e => {
        const sel = e.payload
        if (sel.tabId && !tabIdSetRef.current.has(sel.tabId)) return
        // Clear inspector toggle for the affected tab (Rust side auto-exits).
        if (sel.tabId) {
          useBrowserStore.getState().setInspectMode(sel.tabId, false)
        }
        attachElementToChat(worktreeId, sel)
      })
    )

    unlistens.push(
      listen<{ tabId: string }>('browser:inspector-cancelled', e => {
        if (!tabIdSetRef.current.has(e.payload.tabId)) return
        useBrowserStore.getState().setInspectMode(e.payload.tabId, false)
      })
    )

    return () => {
      for (const p of unlistens) {
        p.then(fn => fn()).catch(err => {
          console.warn('[browser-devtools] unlisten failed:', err)
        })
      }
    }
  }, [worktreeId])

  const onAnnotateSaved = useCallback(
    (savedPath: string | null) => {
      setAnnotateImagePath(null)
      if (!savedPath) return
      const sessionId = useChatStore.getState().getActiveSession(worktreeId)
      if (!sessionId) {
        toast.warning('No active chat session — screenshot saved to disk only.')
        return
      }
      useChatStore.getState().addPendingImage(sessionId, {
        id: generateId(),
        path: savedPath,
        filename: getFilename(savedPath),
        loading: false,
      })
    },
    [worktreeId]
  )

  return {
    annotateImagePath,
    annotateOpen,
    setAnnotateOpen,
    onAnnotateSaved,
  }
}

function attachElementToChat(worktreeId: string, sel: ElementSelection): void {
  const sessionId = useChatStore.getState().getActiveSession(worktreeId)
  if (!sessionId) {
    toast.warning('No active chat session — element capture discarded.')
    return
  }
  const block = formatElementBlock(sel)
  // ChatInput listens for this and merges into the live <textarea> value
  // while keeping the Zustand draft in sync.
  window.dispatchEvent(
    new CustomEvent('command:append-chat-input', {
      detail: { sessionId, text: block },
    })
  )
  toast.success(`Attached <${sel.tagName}> to chat`)
}

function formatElementBlock(sel: ElementSelection): string {
  const lines: string[] = []
  lines.push('```html element')
  lines.push(`<!-- selector: ${sel.cssSelector} -->`)
  if (sel.pageUrl) lines.push(`<!-- page: ${sel.pageUrl} -->`)
  if (sel.boundingRect) {
    const r = sel.boundingRect
    lines.push(
      `<!-- rect: ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(
        r.width
      )}x${Math.round(r.height)} -->`
    )
  }
  lines.push(sel.outerHtml.trim())
  lines.push('```')
  return lines.join('\n')
}
