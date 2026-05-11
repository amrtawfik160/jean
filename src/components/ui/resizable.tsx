'use client'

import * as React from 'react'
import { GripVerticalIcon } from '@/components/icons'
import * as ResizablePrimitive from 'react-resizable-panels'
import type { ImperativePanelHandle } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        '!cursor-col-resize bg-border/60 hover:bg-primary/50 transition-colors duration-150',
        'relative flex w-px items-center justify-center',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 after:cursor-col-resize',
        'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        'data-[panel-group-direction=vertical]:!cursor-row-resize data-[panel-group-direction=vertical]:after:cursor-row-resize data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        'data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2',
        '[&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-surface-2 border border-border/70 z-10 flex h-5 w-3.5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
export type { ImperativePanelHandle }
