import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { invoke, convertFileSrc } from '@/lib/transport'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import {
  ArrowUpRight,
  Crosshair,
  Eraser,
  Pencil,
  Square,
  Type,
  Undo2,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import type { AnnotationStroke, AnnotationTool } from '@/types/browser'

interface ScreenshotAnnotateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** File path to the captured PNG. */
  imagePath: string | null
  /** Called with the saved annotated path (or null on cancel). */
  onSave: (savedPath: string | null) => void
}

const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#111827', // near black
  '#ffffff', // white
] as const

const WIDTHS = [2, 4, 8, 14] as const

function drawStroke(ctx: CanvasRenderingContext2D, s: AnnotationStroke) {
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (s.tool === 'pen') {
    const [first, ...rest] = s.points
    if (!first || rest.length === 0) return
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (const p of rest) {
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  } else if (s.tool === 'rect') {
    const [a, b] = s.points
    if (!a || !b) return
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
  } else if (s.tool === 'arrow') {
    const [a, b] = s.points
    if (!a || !b) return
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    // Arrowhead
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const head = Math.max(10, s.width * 3)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(
      b.x - head * Math.cos(angle - Math.PI / 6),
      b.y - head * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      b.x - head * Math.cos(angle + Math.PI / 6),
      b.y - head * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
  } else if (s.tool === 'text' && s.text) {
    const [p] = s.points
    if (!p) return
    ctx.font = `bold ${Math.max(14, s.width * 5)}px ui-sans-serif, system-ui`
    ctx.textBaseline = 'top'
    ctx.fillText(s.text, p.x, p.y)
  }
  ctx.restore()
}

interface ToolButtonProps {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}
function ToolButton({ active, onClick, label, children }: ToolButtonProps) {
  return (
    <Button
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

export const ScreenshotAnnotateModal = memo(function ScreenshotAnnotateModal({
  open,
  onOpenChange,
  imagePath,
  onSave,
}: ScreenshotAnnotateModalProps) {
  const bitmapCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const annotCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [color, setColor] = useState<string>('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([])
  const [drafting, setDrafting] = useState<AnnotationStroke | null>(null)
  const [naturalSize, setNaturalSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset when a new image opens.
  useEffect(() => {
    if (open) {
      setStrokes([])
      setDrafting(null)
      setTool('pen')
      setColor('#ef4444')
      setStrokeWidth(4)
    }
  }, [open, imagePath])

  // Load bitmap → into a canvas at natural pixel size.
  useEffect(() => {
    if (!open || !imagePath) return
    const img = new Image()
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      const bmp = bitmapCanvasRef.current
      if (bmp) {
        bmp.width = img.naturalWidth
        bmp.height = img.naturalHeight
        const ctx = bmp.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
        }
      }
      const annot = annotCanvasRef.current
      if (annot) {
        annot.width = img.naturalWidth
        annot.height = img.naturalHeight
      }
    }
    img.onerror = () => toast.error('Failed to load screenshot for annotation')
    img.src = convertFileSrc(imagePath)
  }, [open, imagePath])

  // Re-paint annotation canvas whenever strokes change.
  useLayoutEffect(() => {
    const c = annotCanvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    for (const s of strokes) drawStroke(ctx, s)
    if (drafting) drawStroke(ctx, drafting)
  }, [strokes, drafting])

  const eventToCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const c = annotCanvasRef.current
      if (!c) return null
      const rect = c.getBoundingClientRect()
      const scaleX = c.width / rect.width
      const scaleY = c.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    []
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = eventToCanvasPoint(e)
      if (!p) return
      e.currentTarget.setPointerCapture(e.pointerId)

      if (tool === 'text') {
        const text = window.prompt('Annotation text:')?.trim()
        if (!text) return
        const next: AnnotationStroke = {
          tool: 'text',
          color,
          width: strokeWidth,
          points: [p],
          text,
        }
        setStrokes(prev => [...prev, next])
        return
      }

      const next: AnnotationStroke = {
        tool,
        color,
        width: strokeWidth,
        points: tool === 'pen' ? [p] : [p, p],
      }
      setDrafting(next)
    },
    [color, eventToCanvasPoint, strokeWidth, tool]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drafting) return
      const p = eventToCanvasPoint(e)
      if (!p) return
      if (drafting.tool === 'pen') {
        setDrafting({ ...drafting, points: [...drafting.points, p] })
      } else {
        const start = drafting.points[0]
        if (!start) return
        setDrafting({ ...drafting, points: [start, p] })
      }
    },
    [drafting, eventToCanvasPoint]
  )

  const handlePointerUp = useCallback(() => {
    if (!drafting) return
    // Discard zero-length click-only drags.
    const a = drafting.points[0]
    const b = drafting.points[drafting.points.length - 1]
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= 2) {
      setStrokes(prev => [...prev, drafting])
    }
    setDrafting(null)
  }, [drafting])

  const undo = useCallback(() => {
    setStrokes(prev => prev.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setStrokes([])
    setDrafting(null)
  }, [])

  const handleSave = useCallback(async () => {
    const bmp = bitmapCanvasRef.current
    const annot = annotCanvasRef.current
    if (!bmp || !annot || !naturalSize) return
    setSaving(true)
    const toastId = toast.loading('Saving screenshot…')
    try {
      // Composite onto an offscreen canvas at natural resolution.
      const out = document.createElement('canvas')
      out.width = naturalSize.width
      out.height = naturalSize.height
      const ctx = out.getContext('2d')
      if (!ctx) throw new Error('canvas 2d context unavailable')
      ctx.drawImage(bmp, 0, 0)
      ctx.drawImage(annot, 0, 0)

      const blob: Blob = await new Promise((res, rej) =>
        out.toBlob(
          b => (b ? res(b) : rej(new Error('toBlob failed'))),
          'image/png'
        )
      )
      const buf = await blob.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      const data = btoa(binary)
      const path = await invoke<string>('browser_save_annotated_image', {
        data,
      })
      toast.success('Screenshot attached to chat', { id: toastId })
      onSave(path)
      onOpenChange(false)
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`, { id: toastId })
    } finally {
      setSaving(false)
    }
  }, [naturalSize, onOpenChange, onSave])

  const handleCancel = useCallback(() => {
    onSave(null)
    onOpenChange(false)
  }, [onOpenChange, onSave])

  return (
    <Dialog
      open={open}
      onOpenChange={v => (v ? onOpenChange(v) : handleCancel())}
    >
      <DialogContent
        className="!w-fit !max-w-[calc(100vw-2rem)] !h-fit !max-h-[calc(100dvh-2rem)] !rounded-lg !p-0 bg-background/95 backdrop-blur-sm overflow-hidden"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Annotate Screenshot</DialogTitle>
          <DialogDescription>
            Draw, highlight, or add notes before attaching to chat.
          </DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b bg-card/80 px-2 py-1.5">
            <ToolButton
              active={tool === 'pen'}
              onClick={() => setTool('pen')}
              label="Pen"
            >
              <Pencil className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === 'rect'}
              onClick={() => setTool('rect')}
              label="Rectangle"
            >
              <Square className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === 'arrow'}
              onClick={() => setTool('arrow')}
              label="Arrow"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === 'text'}
              onClick={() => setTool('text')}
              label="Text"
            >
              <Type className="h-3.5 w-3.5" />
            </ToolButton>

            <div className="mx-1 h-4 w-px bg-border" />

            <div className="flex items-center gap-0.5">
              {PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'h-5 w-5 rounded-full border transition',
                    color === c
                      ? 'border-foreground ring-2 ring-ring'
                      : 'border-border/60'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>

            <div className="mx-1 h-4 w-px bg-border" />

            <div className="flex items-center gap-0.5">
              {WIDTHS.map(w => (
                <button
                  key={w}
                  type="button"
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded text-xs',
                    strokeWidth === w
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => setStrokeWidth(w)}
                  aria-label={`Stroke ${w}px`}
                >
                  <span
                    className="block rounded-full bg-current"
                    style={{ width: `${w}px`, height: `${w}px` }}
                  />
                </button>
              ))}
            </div>

            <div className="mx-1 h-4 w-px bg-border" />

            <ToolButton active={false} onClick={undo} label="Undo">
              <Undo2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={false} onClick={clear} label="Clear">
              <Eraser className="h-3.5 w-3.5" />
            </ToolButton>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Crosshair className="h-3.5 w-3.5" />
                Attach to chat
              </Button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative overflow-auto bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)_50%_/_16px_16px]"
            style={{
              maxWidth: 'calc(100vw - 4rem)',
              maxHeight: 'calc(100dvh - 8rem)',
            }}
          >
            <div
              className="relative"
              style={{
                width: naturalSize?.width ?? 0,
                height: naturalSize?.height ?? 0,
              }}
            >
              <canvas
                ref={bitmapCanvasRef}
                className="block"
                style={{ display: 'block' }}
              />
              <canvas
                ref={annotCanvasRef}
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
