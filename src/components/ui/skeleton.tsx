import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
