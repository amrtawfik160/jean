import React, { useCallback, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePreferences, usePatchPreferences } from '@/services/preferences'
import {
  uiFontOptions,
  chatFontOptions,
  syntaxThemeDarkOptions,
  fileEditModeOptions,
  FONT_SIZE_DEFAULT,
  ZOOM_LEVEL_DEFAULT,
  uiFontScaleTicks,
  chatFontScaleTicks,
  zoomLevelTicks,
  type UIFont,
  type ChatFont,
  type SyntaxTheme,
  type FileEditMode,
} from '@/types/preferences'
import { isMacOS } from '@/lib/platform'
import { SettingsSection } from '../SettingsSection'

const InlineField: React.FC<{
  label: string
  description?: string
  children: React.ReactNode
}> = ({ label, description, children }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
    <div className="space-y-0.5 sm:w-96 sm:shrink-0">
      <Label className="text-sm text-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    {children}
  </div>
)

const ScalingField: React.FC<{
  label: string
  description?: string
  children: React.ReactNode
}> = ({ label, description, children }) => (
  <div className="space-y-2">
    <div className="space-y-0.5">
      <Label className="text-sm text-foreground">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    {children}
  </div>
)

const modKey = isMacOS ? 'Cmd' : 'Ctrl'

export const AppearancePane: React.FC = () => {
  const { data: preferences } = usePreferences()
  const patchPreferences = usePatchPreferences()

  const prefsZoom = preferences?.zoom_level ?? ZOOM_LEVEL_DEFAULT
  const [localZoom, setLocalZoom] = useState<number | null>(null)
  const zoomValue = localZoom ?? prefsZoom

  const handleFontSizeChange = useCallback(
    (field: 'ui_font_size' | 'chat_font_size', value: number) => {
      if (!isNaN(value) && value > 0) {
        patchPreferences.mutate({ [field]: value })
      }
    },
    [patchPreferences]
  )

  const handleZoomCommit = useCallback(
    (value: number) => {
      setLocalZoom(null)
      patchPreferences.mutate({ zoom_level: value })
    },
    [patchPreferences]
  )

  const handleFontChange = useCallback(
    (field: 'ui_font' | 'chat_font', value: UIFont | ChatFont) => {
      patchPreferences.mutate({ [field]: value })
    },
    [patchPreferences]
  )

  const handleSyntaxThemeChange = useCallback(
    (value: SyntaxTheme) => {
      patchPreferences.mutate({ syntax_theme_dark: value })
    },
    [patchPreferences]
  )

  const handleFileEditModeChange = useCallback(
    (value: FileEditMode) => {
      patchPreferences.mutate({ file_edit_mode: value })
    },
    [patchPreferences]
  )

  return (
    <div className="space-y-6">
      <SettingsSection title="Theme" anchorId="pref-appearance-section-theme">
        <div className="space-y-4">
          <InlineField
            label="Syntax theme"
            description="Highlighting theme used for code blocks"
          >
            <Select
              value={preferences?.syntax_theme_dark ?? 'vitesse-black'}
              onValueChange={value =>
                handleSyntaxThemeChange(value as SyntaxTheme)
              }
              disabled={patchPreferences.isPending}
            >
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {syntaxThemeDarkOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InlineField>
        </div>
      </SettingsSection>

      <SettingsSection title="Fonts" anchorId="pref-appearance-section-fonts">
        <div className="space-y-4">
          <InlineField label="UI font" description="Font for interface text">
            <Select
              value={preferences?.ui_font ?? 'inter'}
              onValueChange={value =>
                handleFontChange('ui_font', value as UIFont)
              }
              disabled={patchPreferences.isPending}
            >
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {uiFontOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InlineField>

          <InlineField label="Chat font" description="Font for chat messages">
            <Select
              value={preferences?.chat_font ?? 'jetbrains-mono'}
              onValueChange={value =>
                handleFontChange('chat_font', value as ChatFont)
              }
              disabled={patchPreferences.isPending}
            >
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {chatFontOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InlineField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Scaling"
        anchorId="pref-appearance-section-scaling"
      >
        <div className="space-y-5">
          <ScalingField
            label="UI font scaling"
            description="Increase or decrease the size of the interface font"
          >
            <Slider
              ticks={uiFontScaleTicks}
              value={preferences?.ui_font_size ?? FONT_SIZE_DEFAULT}
              onValueChange={value =>
                handleFontSizeChange('ui_font_size', value)
              }
              disabled={patchPreferences.isPending}
            />
          </ScalingField>

          <ScalingField
            label="Chat font scaling"
            description="Increase or decrease the size of the chat font"
          >
            <Slider
              ticks={chatFontScaleTicks}
              value={preferences?.chat_font_size ?? FONT_SIZE_DEFAULT}
              onValueChange={value =>
                handleFontSizeChange('chat_font_size', value)
              }
              disabled={patchPreferences.isPending}
            />
          </ScalingField>

          <ScalingField
            label="Zoom level"
            description="Control the zoom level to adjust the size of the interface"
          >
            <Slider
              ticks={zoomLevelTicks}
              value={zoomValue}
              onValueChange={setLocalZoom}
              onValueCommit={handleZoomCommit}
              disabled={patchPreferences.isPending}
            />
            <p className="text-xs text-muted-foreground">
              You can change the zoom level with {modKey} +/- and reset to the
              default zoom with {modKey}+0.
            </p>
          </ScalingField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="File Viewer"
        anchorId="pref-appearance-section-file-viewer"
      >
        <div className="space-y-4">
          <InlineField
            label="Edit files in"
            description="How to edit files when viewing them in Jean"
          >
            <Select
              value={preferences?.file_edit_mode ?? 'external'}
              onValueChange={value =>
                handleFileEditModeChange(value as FileEditMode)
              }
              disabled={patchPreferences.isPending}
            >
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {fileEditModeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InlineField>
        </div>
      </SettingsSection>
    </div>
  )
}
