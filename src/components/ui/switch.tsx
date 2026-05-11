'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'transition-[background-color,box-shadow,border-color] duration-150 outline-none',
        'shadow-[inset_0_1px_2px_oklch(0_0_0/0.4)]',
        'data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_1px_2px_oklch(0_0_0/0.3),0_0_0_1px_oklch(0.66_0.19_268/0.5)]',
        'data-[state=unchecked]:bg-surface-3',
        'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-foreground shadow-[0_1px_2px_oklch(0_0_0/0.5)]',
          'transition-transform duration-200',
          'data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=checked]:bg-primary-foreground',
          'data-[state=unchecked]:translate-x-[2px]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
