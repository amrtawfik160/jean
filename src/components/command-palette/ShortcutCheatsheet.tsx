import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search, X } from '@/components/icons'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import {
  KEYBINDING_DEFINITIONS,
  formatShortcutDisplay,
  type KeybindingDefinition,
  type KeybindingsMap,
} from '@/types/keybindings'
import { usePreferences } from '@/services/preferences'

const CATEGORY_LABEL: Record<KeybindingDefinition['category'], string> = {
  navigation: 'Navigation',
  git: 'Git',
  chat: 'Chat',
}

function ShortcutRow({
  definition,
  shortcut,
}: {
  definition: KeybindingDefinition
  shortcut: string
}) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-md px-3 py-1.5 hover:bg-accent">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">
          {definition.label}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {definition.description}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {formatShortcutDisplay(shortcut)
          .split(' + ')
          .map((part, i) => (
            <Kbd key={i}>{part}</Kbd>
          ))}
      </div>
    </div>
  )
}

export function ShortcutCheatsheet() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: preferences } = usePreferences()

  const keybindings: KeybindingsMap = useMemo(
    () => ({ ...preferences?.keybindings }),
    [preferences?.keybindings]
  )

  useEffect(() => {
    const handler = () => setOpen(prev => !prev)
    window.addEventListener('toggle-shortcut-cheatsheet', handler)
    return () =>
      window.removeEventListener('toggle-shortcut-cheatsheet', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [open])

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? KEYBINDING_DEFINITIONS.filter(
          d =>
            d.label.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.action.toLowerCase().includes(q)
        )
      : KEYBINDING_DEFINITIONS
    return filtered.reduce<Record<string, KeybindingDefinition[]>>(
      (acc, d) => {
        ;(acc[d.category] ??= []).push(d)
        return acc
      },
      {}
    )
  }, [search])

  const close = useCallback(() => setOpen(false), [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-background/70 backdrop-blur-md p-4 sm:p-12"
          onClick={close}
        >
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -4, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className={cn(
              'flex w-full max-w-3xl max-h-[80dvh] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl'
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search shortcuts…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {Object.entries(grouped).length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No shortcuts match “{search}”.
                </div>
              ) : (
                Object.entries(grouped).map(([category, defs]) => (
                  <div key={category} className="mb-4">
                    <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {
                        CATEGORY_LABEL[
                          category as KeybindingDefinition['category']
                        ]
                      }
                    </div>
                    <div className="space-y-0.5">
                      {defs.map(def => (
                        <ShortcutRow
                          key={def.action}
                          definition={def}
                          shortcut={
                            keybindings[def.action] ?? def.default_shortcut
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span>
                Press <Kbd>Esc</Kbd> to close
              </span>
              <span>{KEYBINDING_DEFINITIONS.length} shortcuts</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
