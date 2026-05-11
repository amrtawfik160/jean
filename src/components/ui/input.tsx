import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        'flex h-8 w-full min-w-0 rounded-lg border border-border bg-surface-1 px-3 py-1 text-sm',
        'text-foreground placeholder:text-muted-foreground',
        'shadow-[inset_0_0_0_1px_oklch(0_0_0/0.05)]',
        'transition-[color,box-shadow,border-color,background-color] duration-150',
        'outline-none',
        // File input
        'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Selection
        'selection:bg-primary/30 selection:text-primary-foreground',
        // Hover
        'hover:border-border/80',
        // Focus
        'focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:bg-surface-2',
        // Invalid
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        // Disabled
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
