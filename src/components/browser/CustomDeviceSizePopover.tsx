import { memo, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Settings } from '@/components/icons'
import { useBrowserStore } from '@/store/browser-store'

interface CustomDeviceSizePopoverProps {
  tabId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_CUSTOM = { width: 414, height: 896, dpr: 2 }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export const CustomDeviceSizePopover = memo(function CustomDeviceSizePopover({
  tabId,
  open,
  onOpenChange,
}: CustomDeviceSizePopoverProps) {
  const size = useBrowserStore(
    state => state.customSizeByTab[tabId] ?? DEFAULT_CUSTOM
  )
  const [w, setW] = useState(String(size.width))
  const [h, setH] = useState(String(size.height))
  const [d, setD] = useState(String(size.dpr))

  useEffect(() => {
    if (open) {
      setW(String(size.width))
      setH(String(size.height))
      setD(String(size.dpr))
    }
  }, [open, size.width, size.height, size.dpr])

  const apply = () => {
    const width = clamp(Number(w) || 0, 100, 4096)
    const height = clamp(Number(h) || 0, 100, 4096)
    const dpr = clamp(Number(d) || 1, 1, 4)
    useBrowserStore.getState().setCustomSize(tabId, { width, height, dpr })
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Edit custom size"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]" htmlFor="custom-w">
              Width
            </Label>
            <Input
              id="custom-w"
              type="number"
              inputMode="numeric"
              className="h-7 text-xs"
              value={w}
              onChange={e => setW(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]" htmlFor="custom-h">
              Height
            </Label>
            <Input
              id="custom-h"
              type="number"
              inputMode="numeric"
              className="h-7 text-xs"
              value={h}
              onChange={e => setH(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]" htmlFor="custom-dpr">
              DPR
            </Label>
            <Input
              id="custom-dpr"
              type="number"
              step="0.5"
              inputMode="decimal"
              className="h-7 text-xs"
              value={d}
              onChange={e => setD(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" className="h-7 px-2 text-xs" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})
