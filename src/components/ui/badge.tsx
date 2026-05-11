import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  cn(
    'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden',
    '[&>svg]:size-3 [&>svg]:pointer-events-none',
    'focus-visible:ring-2 focus-visible:ring-ring/50',
    'transition-[color,background-color,border-color,box-shadow] duration-150'
  ),
  {
    variants: {
      variant: {
        default:
          'bg-primary/15 text-primary border border-primary/30 [a&]:hover:bg-primary/25',
        secondary:
          'bg-surface-2 text-secondary-foreground border border-border/40 [a&]:hover:bg-surface-3',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/30 [a&]:hover:bg-destructive/25',
        outline:
          'bg-transparent text-foreground border border-border [a&]:hover:bg-surface-2',
        muted:
          'bg-muted/60 text-muted-foreground border border-transparent [a&]:hover:bg-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
