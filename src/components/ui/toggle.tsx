'use client'

import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toggleVariants = cva(
  cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap',
    'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97]',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    'hover:bg-accent/60 hover:text-foreground',
    'data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-[inset_0_0_0_1px_oklch(0.66_0.19_268/0.4)]'
  ),
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-border bg-surface-1 hover:bg-surface-2 hover:text-foreground',
      },
      size: {
        default: 'h-8 px-2 min-w-8',
        sm: 'h-7 px-1.5 min-w-7',
        lg: 'h-9 px-2.5 min-w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
