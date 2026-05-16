import type { DevicePreset } from '@/types/browser'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const PIXEL_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const GALAXY_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

export const RESPONSIVE_PRESET_ID = 'responsive'
export const CUSTOM_PRESET_ID = 'custom'

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  {
    id: RESPONSIVE_PRESET_ID,
    label: 'Responsive',
    width: null,
    height: null,
    dpr: null,
    userAgent: null,
    category: 'desktop',
  },
  {
    id: 'iphone-se',
    label: 'iPhone SE',
    width: 375,
    height: 667,
    dpr: 2,
    userAgent: IPHONE_UA,
    category: 'phone',
  },
  {
    id: 'iphone-14',
    label: 'iPhone 14',
    width: 390,
    height: 844,
    dpr: 3,
    userAgent: IPHONE_UA,
    category: 'phone',
  },
  {
    id: 'iphone-14-pro-max',
    label: 'iPhone 14 Pro Max',
    width: 430,
    height: 932,
    dpr: 3,
    userAgent: IPHONE_UA,
    category: 'phone',
  },
  {
    id: 'pixel-7',
    label: 'Pixel 7',
    width: 412,
    height: 915,
    dpr: 2.625,
    userAgent: PIXEL_UA,
    category: 'phone',
  },
  {
    id: 'galaxy-s23',
    label: 'Galaxy S23',
    width: 360,
    height: 780,
    dpr: 3,
    userAgent: GALAXY_UA,
    category: 'phone',
  },
  {
    id: 'ipad-mini',
    label: 'iPad Mini',
    width: 768,
    height: 1024,
    dpr: 2,
    userAgent: IPAD_UA,
    category: 'tablet',
  },
  {
    id: 'ipad-pro',
    label: 'iPad Pro 11"',
    width: 834,
    height: 1194,
    dpr: 2,
    userAgent: IPAD_UA,
    category: 'tablet',
  },
  {
    id: 'macbook-13',
    label: 'MacBook 13"',
    width: 1280,
    height: 800,
    dpr: 2,
    userAgent: DESKTOP_UA,
    category: 'desktop',
  },
  {
    id: 'desktop-1440',
    label: 'Desktop 1440p',
    width: 1440,
    height: 900,
    dpr: 1,
    userAgent: DESKTOP_UA,
    category: 'desktop',
  },
  {
    id: CUSTOM_PRESET_ID,
    label: 'Custom…',
    width: null,
    height: null,
    dpr: null,
    userAgent: null,
    category: 'desktop',
  },
] as const

export function getPreset(id: string | undefined): DevicePreset {
  return (
    DEVICE_PRESETS.find(p => p.id === id) ?? (DEVICE_PRESETS[0] as DevicePreset)
  )
}

export function isResponsive(id: string | undefined): boolean {
  return !id || id === RESPONSIVE_PRESET_ID
}

export function isCustom(id: string | undefined): boolean {
  return id === CUSTOM_PRESET_ID
}
