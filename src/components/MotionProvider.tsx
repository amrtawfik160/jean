import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Global motion configuration. Honors `prefers-reduced-motion` automatically
 * via `MotionConfig`'s `reducedMotion="user"` setting.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 32,
        mass: 0.7,
      }}
    >
      {children}
    </MotionConfig>
  )
}
