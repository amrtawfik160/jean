import { memo, useCallback, useMemo } from 'react'
import { Clock, GripVertical, Play, X } from '@/components/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { ImageLightbox } from '@/components/chat/ImageLightbox'
import { TextFileLightbox } from '@/components/chat/TextFileLightbox'
import { FileMentionBadge } from '@/components/chat/FileMentionBadge'
import { SkillBadge } from '@/components/chat/SkillBadge'
import { MessageSettingsBadges } from '@/components/chat/MessageSettingsBadges'
import { normalizePath } from '@/lib/path-utils'
import type { QueuedMessage } from '@/types/chat'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

interface QueuedMessageItemProps {
  message: QueuedMessage
  index: number
  sessionId: string
  worktreePath?: string
  onRemove: (sessionId: string, messageId: string) => void
  onForceSend?: (sessionId: string) => void
  isSessionIdle?: boolean
  draggable?: boolean
}

/**
 * Single queued message display
 * Memoized to prevent re-renders when sibling messages change
 */
export const QueuedMessageItem = memo(function QueuedMessageItem({
  message,
  index,
  sessionId,
  worktreePath,
  onRemove,
  onForceSend,
  isSessionIdle,
  draggable = false,
}: QueuedMessageItemProps) {
  const handleRemove = useCallback(() => {
    onRemove(sessionId, message.id)
  }, [onRemove, sessionId, message.id])

  const handleForceSend = useCallback(() => {
    onForceSend?.(sessionId)
  }, [onForceSend, sessionId])

  const showForceSend = index === 0 && isSessionIdle && onForceSend

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: message.id,
    disabled: !draggable,
  })

  const dragStyle: React.CSSProperties = useMemo(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition,
      zIndex: isDragging ? 5 : 0,
      opacity: isDragging ? 0.85 : undefined,
    }),
    [transform, transition, isDragging]
  )

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="w-full flex justify-end overflow-visible"
    >
      <div
        className={`relative group text-foreground border border-dashed border-muted-foreground/40 rounded-lg px-3 py-2 max-w-[70%] bg-muted/10 min-w-0 break-words opacity-60 overflow-visible mr-1 mt-2 ${
          isDragging ? 'shadow-lg' : ''
        }`}
      >
        {/* Queue badge */}
        <div className="absolute -top-2 -left-2 flex items-center gap-1 bg-muted rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground z-10">
          <Clock className="h-2.5 w-2.5" />
          <span>#{index + 1}</span>
        </div>
        {/* Drag handle - left side, appears on hover */}
        {draggable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder queued message"
                className={`absolute top-1/2 -left-7 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-opacity z-10 touch-none ${
                  isDragging
                    ? 'opacity-100 cursor-grabbing'
                    : 'opacity-0 group-hover:opacity-100 cursor-grab'
                }`}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder</TooltipContent>
          </Tooltip>
        )}
        {/* Force send button - only on first queued message when session is idle */}
        {showForceSend && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleForceSend}
                className="absolute -top-2 -right-7 p-0.5 bg-muted hover:bg-green-600 text-muted-foreground hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <Play className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Force send now</TooltipContent>
          </Tooltip>
        )}
        {/* Remove button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-0.5 bg-muted hover:bg-destructive text-muted-foreground hover:text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove from queue</TooltipContent>
        </Tooltip>
        {/* Attached images */}
        {message.pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {message.pendingImages.map((img, idx) => (
              <ImageLightbox
                key={`${message.id}-img-${idx}`}
                src={img.path}
                alt={`Attached image ${idx + 1}`}
                thumbnailClassName="h-20 max-w-40 object-contain rounded border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
              />
            ))}
          </div>
        )}
        {/* Attached text files */}
        {message.pendingTextFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {message.pendingTextFiles.map((tf, idx) => (
              <TextFileLightbox
                key={`${message.id}-txt-${idx}`}
                path={tf.path}
                size={tf.size}
              />
            ))}
          </div>
        )}
        {/* Attached file/directory mentions */}
        {message.pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {message.pendingFiles.map((f, idx) => (
              <FileMentionBadge
                key={`${message.id}-file-${idx}`}
                path={f.relativePath}
                worktreePath={worktreePath ?? ''}
                sourceRootPath={f.sourceRootPath}
                sourceProjectName={f.sourceProjectName}
                isDirectory={f.isDirectory}
              />
            ))}
          </div>
        )}
        {/* Attached skills */}
        {message.pendingSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {message.pendingSkills.map((skill, idx) => {
              const parts = normalizePath(skill.path).split('/')
              const skillsIdx = parts.findIndex(p => p === 'skills')
              const name =
                skillsIdx >= 0 && parts[skillsIdx + 1]
                  ? parts[skillsIdx + 1]
                  : skill.name
              return (
                <SkillBadge
                  key={`${message.id}-skill-${idx}`}
                  skill={{
                    id: skill.id,
                    name: name ?? skill.name,
                    path: skill.path,
                  }}
                  compact
                />
              )
            })}
          </div>
        )}
        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap">{message.message}</div>
        {/* Captured settings */}
        <div className="mt-1.5">
          <MessageSettingsBadges
            model={message.model}
            executionMode={message.executionMode}
            thinkingLevel={message.thinkingLevel}
            effortLevel={message.effortLevel}
            isCursor={message.backend === 'cursor'}
          />
        </div>
      </div>
    </div>
  )
})

interface QueuedMessagesListProps {
  messages: QueuedMessage[]
  sessionId: string
  worktreePath?: string
  onRemove: (sessionId: string, messageId: string) => void
  onForceSend?: (sessionId: string) => void
  onReorder?: (sessionId: string, orderedIds: string[]) => void
  isSessionIdle?: boolean
}

/**
 * List of queued messages
 * Memoized container that renders memoized items with drag-and-drop reordering
 */
export const QueuedMessagesList = memo(function QueuedMessagesList({
  messages,
  sessionId,
  worktreePath,
  onRemove,
  onForceSend,
  onReorder,
  isSessionIdle,
}: QueuedMessagesListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const itemIds = useMemo(() => messages.map(m => m.id), [messages])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !onReorder) return

      const oldIndex = itemIds.indexOf(String(active.id))
      const newIndex = itemIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return

      const reordered = arrayMove(itemIds, oldIndex, newIndex)
      onReorder(sessionId, reordered)
    },
    [itemIds, onReorder, sessionId]
  )

  if (messages.length === 0) return null

  // Only enable drag if there's more than one message and a reorder handler exists
  const canDrag = messages.length > 1 && Boolean(onReorder)

  return (
    <div className="space-y-3 mt-4 pr-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {messages.map((msg, index) => (
            <QueuedMessageItem
              key={msg.id}
              message={msg}
              index={index}
              sessionId={sessionId}
              worktreePath={worktreePath}
              onRemove={onRemove}
              onForceSend={onForceSend}
              isSessionIdle={isSessionIdle}
              draggable={canDrag}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
})
