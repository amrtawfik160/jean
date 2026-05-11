import { getModifierSymbol, isMacOS } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'

interface SendCancelButtonProps {
  isSending: boolean
  canSend: boolean
  queuedMessageCount?: number
  onCancel: () => void
}

export function SendCancelButton({
  isSending,
  canSend,
  queuedMessageCount,
  onCancel,
}: SendCancelButtonProps) {
  const isMobile = useIsMobile()

  // Linear-style pill button with rounded corners + subtle shadow
  const pillBase = cn(
    'flex h-7 items-center justify-center text-xs font-medium',
    'rounded-md px-3 gap-1.5',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'active:scale-[0.97] disabled:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-50'
  )

  if (isSending) {
    const cancelButton = (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              pillBase,
              'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_oklch(0_0_0/0.4),inset_0_1px_0_oklch(1_0_0/0.1)]'
            )}
          >
            <span>{queuedMessageCount ? 'Skip to Next' : 'Cancel'}</span>
            {!isMobile && (
              <Kbd className="ml-0.5 h-4 text-[10px] bg-primary-foreground/20 text-primary-foreground border-transparent">
                {isMacOS ? `${getModifierSymbol()}⌥⌫` : 'Ctrl+Alt+⌫'}
              </Kbd>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {queuedMessageCount
            ? `Skip to next queued message (${isMacOS ? `${getModifierSymbol()}+Option+Backspace` : 'Ctrl+Alt+Backspace'})`
            : `Cancel (${isMacOS ? `${getModifierSymbol()}+Option+Backspace` : 'Ctrl+Alt+Backspace'})`}
        </TooltipContent>
      </Tooltip>
    )

    if (canSend) {
      return (
        <div className="flex items-center gap-1">
          {cancelButton}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="submit"
                className={cn(
                  pillBase,
                  'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-border/40'
                )}
              >
                <span>Queue</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isMobile ? 'Queue message' : 'Queue message (Enter)'}
            </TooltipContent>
          </Tooltip>
        </div>
      )
    }

    return cancelButton
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            pillBase,
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_0_oklch(0_0_0/0.4),inset_0_1px_0_oklch(1_0_0/0.1)]'
              : 'bg-surface-2 text-muted-foreground border border-border/40'
          )}
        >
          <span>Send</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isMobile ? 'Send message' : 'Send message (Enter)'}
      </TooltipContent>
    </Tooltip>
  )
}
