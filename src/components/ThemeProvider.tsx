import { useEffect, useMemo } from 'react'
import { ThemeProviderContext } from '@/lib/theme-context'

const noop = () => undefined

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light')
    root.classList.add('dark')
  }, [])

  const value = useMemo(
    () => ({
      theme: 'dark' as const,
      // Light theme has been removed; theme is fixed to dark.
      setTheme: noop,
    }),
    []
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
