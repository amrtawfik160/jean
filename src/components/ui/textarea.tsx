import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({
  className,
  wrap,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      wrap={wrap ?? 'soft'}
      className={cn(
        'flex min-h-16 min-w-0 w-full field-sizing-content',
        'rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
        'shadow-[inset_0_0_0_1px_oklch(0_0_0/0.05)]',
        'transition-[color,box-shadow,border-color,background-color] duration-150',
        'outline-none',
        'hover:border-border/80',
        'focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:bg-surface-2',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
