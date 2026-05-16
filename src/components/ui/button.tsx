import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Linear-style button: tight rounded-lg corners (8px), refined hover states,
 * subtle scale on press, soft accent ring on focus. Default size is 32px tall
 * to match the new Linear-tier density.
 */
const buttonVariants = cva(
  cn(
    'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150',
    'active:scale-[0.98] disabled:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer'
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary text-primary-foreground border border-primary/0',
          'hover:bg-primary/90 hover:shadow-[0_1px_0_0_oklch(0_0_0/0.6)_inset,0_0_0_1px_oklch(0.66_0.19_268/0.4)]'
        ),
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/50',
        outline: cn(
          'border border-border bg-surface-1 text-foreground',
          'hover:bg-surface-2 hover:border-border'
        ),
        secondary: cn(
          'bg-surface-2 text-secondary-foreground border border-border/40',
          'hover:bg-surface-3'
        ),
        ghost:
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 has-[>svg]:px-2.5',
        sm: 'h-7 rounded-md gap-1 px-2.5 text-xs has-[>svg]:px-2',
        lg: 'h-9 rounded-lg px-4 has-[>svg]:px-3',
        icon: 'size-8',
        'icon-sm': 'size-7 rounded-md',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
