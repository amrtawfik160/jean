import { useState, useCallback } from 'react'
import { convertFileSrc } from '@/lib/transport'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface ImageLightboxProps {
  /** File path to the image */
  src: string
  /** Alt text for accessibility */
  alt: string
  /** Thumbnail className */
  thumbnailClassName?: string
  /** Optional wrapper className */
  className?: string
  /** Children to render as the clickable thumbnail (if not using default img) */
  children?: React.ReactNode
}

/**
 * Displays an image thumbnail that opens in a full-size lightbox modal when clicked
 */
export function ImageLightbox({
  src,
  alt,
  thumbnailClassName,
  className,
  children,
}: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  const assetSrc = convertFileSrc(src)

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md ${className ?? ''}`}
      >
        {children ?? (
          <img src={assetSrc} alt={alt} className={thumbnailClassName} />
        )}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="!w-fit !max-w-[calc(100vw-1rem)] !h-fit !max-h-[calc(100dvh-1rem)] !rounded-lg !p-2 bg-background/95 backdrop-blur-sm"
          showCloseButton={true}
        >
          <VisuallyHidden>
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Preview of image: {alt}</DialogDescription>
          </VisuallyHidden>
          <img
            src={assetSrc}
            alt={alt}
            className="block max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] object-contain rounded-md"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
