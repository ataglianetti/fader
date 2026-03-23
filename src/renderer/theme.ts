/**
 * Fader Design Tokens — Dynamic theme system
 *
 * Themes are loaded from JSON files in themes/. The simplified 16-token
 * palette is expanded to the full ~50-token ColorPalette via resolveTokens().
 *
 * Public API is unchanged: useColors(), getColors(), ColorPalette type.
 */
import { create } from 'zustand'
import { resolveTokens, applyTypography, loadThemes, type FaderTheme } from './themeLoader'

// ─── Fallback palette (used before themes load from IPC) ───

const fallbackDark = {
  bgPrimary: '#262626', bgSecondary: '#212121', bgTertiary: '#2e2e2e',
  accent: '#879eaa', accentHover: '#9ab3bf',
  textPrimary: '#d1d1d1', textSecondary: '#b3b3b3', textMuted: '#999999',
  success: '#a8c373', error: '#d04255', warning: '#e5b567',
  border: '#353535', borderActive: '#505050',
  codeBlockBg: '#212121', selection: 'hsla(201, 70%, 40%, 0.3)',
  scrollbarThumb: '#404040', scrollbarTrack: '#262626',
}

const fallbackLight = {
  bgPrimary: '#ffffff', bgSecondary: '#f5f5f5', bgTertiary: '#ebebeb',
  accent: '#6b8ea0', accentHover: '#597a8c',
  textPrimary: '#0f0f0f', textSecondary: '#828282', textMuted: '#b5b5b5',
  success: '#699b3e', error: '#c13040', warning: '#c99530',
  border: '#e6e6e6', borderActive: '#c0c0c0',
  codeBlockBg: '#f5f5f5', selection: 'hsla(201, 50%, 76%, 0.3)',
  scrollbarThumb: '#c5c5c5', scrollbarTrack: '#ffffff',
}

// Generate initial full palettes from fallback (Minimal dark)
const initialDarkTokens = resolveTokens(fallbackDark, true)
const initialLightTokens = resolveTokens(fallbackLight, false)

export type ColorPalette = { [K in keyof typeof initialDarkTokens]: string }

// ─── Active palette cache ───

let _activeDark: ColorPalette = initialDarkTokens
let _activeLight: ColorPalette = initialLightTokens

// ─── Theme store ───

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  isDark: boolean
  themeMode: ThemeMode
  selectedThemeId: string
  availableThemes: FaderTheme[]
  soundEnabled: boolean
  expandedUI: boolean
  _systemIsDark: boolean
  setIsDark: (isDark: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  setTheme: (themeId: string) => void
  initThemes: () => Promise<void>
  setSoundEnabled: (enabled: boolean) => void
  setExpandedUI: (expanded: boolean) => void
  setSystemTheme: (isDark: boolean) => void
}

/** Convert camelCase token name to --clui-kebab-case CSS custom property */
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/** Sync all JS design tokens to CSS custom properties on :root */
function syncTokensToCss(tokens: ColorPalette): void {
  const style = document.documentElement.style
  for (const [key, value] of Object.entries(tokens)) {
    style.setProperty(`--clui-${camelToKebab(key)}`, value)
  }
}

function applyMode(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
  syncTokensToCss(isDark ? _activeDark : _activeLight)
}

/** Resolve and cache both palettes for a theme */
function activateTheme(theme: FaderTheme): void {
  _activeDark = resolveTokens(theme.dark, true)
  _activeLight = resolveTokens(theme.light, false)
  applyTypography(theme)
}

const SETTINGS_KEY = 'fader-settings'

interface SavedSettings {
  themeMode: ThemeMode
  selectedThemeId: string
  soundEnabled: boolean
  expandedUI: boolean
}

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        themeMode: ['light', 'dark', 'system'].includes(parsed.themeMode) ? parsed.themeMode : 'system',
        selectedThemeId: typeof parsed.selectedThemeId === 'string' ? parsed.selectedThemeId : 'minimal',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        expandedUI: typeof parsed.expandedUI === 'boolean' ? parsed.expandedUI : false,
      }
    }
  } catch {}
  // Also check legacy key for migration
  try {
    const legacy = localStorage.getItem('clui-settings')
    if (legacy) {
      const parsed = JSON.parse(legacy)
      return {
        themeMode: ['light', 'dark'].includes(parsed.themeMode) ? parsed.themeMode : 'system',
        selectedThemeId: 'minimal',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        expandedUI: typeof parsed.expandedUI === 'boolean' ? parsed.expandedUI : false,
      }
    }
  } catch {}
  return { themeMode: 'system', selectedThemeId: 'minimal', soundEnabled: true, expandedUI: false }
}

function saveSettings(s: SavedSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

// Always start in compact UI mode on launch.
const saved = { ...loadSettings(), expandedUI: false }

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: saved.themeMode === 'dark' ? true : saved.themeMode === 'light' ? false : true,
  themeMode: saved.themeMode,
  selectedThemeId: saved.selectedThemeId,
  availableThemes: [],
  soundEnabled: saved.soundEnabled,
  expandedUI: saved.expandedUI,
  _systemIsDark: true,

  setIsDark: (isDark) => {
    set({ isDark })
    applyMode(isDark)
  },

  setThemeMode: (mode) => {
    const resolved = mode === 'system' ? get()._systemIsDark : mode === 'dark'
    set({ themeMode: mode, isDark: resolved })
    applyMode(resolved)
    const { selectedThemeId, soundEnabled, expandedUI } = get()
    saveSettings({ themeMode: mode, selectedThemeId, soundEnabled, expandedUI })
  },

  setTheme: (themeId) => {
    const { availableThemes, themeMode, soundEnabled, expandedUI, _systemIsDark } = get()
    const theme = availableThemes.find((t) => t.id === themeId)
    if (!theme) return
    activateTheme(theme)
    const isDark = themeMode === 'system' ? _systemIsDark : themeMode === 'dark'
    set({ selectedThemeId: themeId, isDark })
    applyMode(isDark)
    saveSettings({ themeMode, selectedThemeId: themeId, soundEnabled, expandedUI })
  },

  initThemes: async () => {
    const themes = await loadThemes()
    if (themes.length === 0) return
    set({ availableThemes: themes })
    const { selectedThemeId, themeMode, _systemIsDark } = get()
    const theme = themes.find((t) => t.id === selectedThemeId) || themes[0]
    activateTheme(theme)
    const isDark = themeMode === 'system' ? _systemIsDark : themeMode === 'dark'
    set({ selectedThemeId: theme.id, isDark })
    applyMode(isDark)
  },

  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    const { themeMode, selectedThemeId, expandedUI } = get()
    saveSettings({ themeMode, selectedThemeId, soundEnabled: enabled, expandedUI })
  },

  setExpandedUI: (expanded) => {
    set({ expandedUI: expanded })
    const { themeMode, selectedThemeId, soundEnabled } = get()
    saveSettings({ themeMode, selectedThemeId, soundEnabled, expandedUI: expanded })
  },

  setSystemTheme: (isDark) => {
    set({ _systemIsDark: isDark })
    if (get().themeMode === 'system') {
      set({ isDark })
      applyMode(isDark)
    }
  },
}))

// Initialize CSS vars with fallback theme (real themes load async via initThemes)
syncTokensToCss(saved.themeMode === 'light' ? initialLightTokens : initialDarkTokens)

/** Reactive hook — returns the active color palette */
export function useColors(): ColorPalette {
  const isDark = useThemeStore((s) => s.isDark)
  return isDark ? _activeDark : _activeLight
}

/** Non-reactive getter — use outside React components */
export function getColors(isDark: boolean): ColorPalette {
  return isDark ? _activeDark : _activeLight
}

// ─── Backward compatibility ───
// Legacy static export — components being migrated should use useColors() instead
export const colors = initialDarkTokens

// ─── Spacing ───

export const spacing = {
  contentWidth: 460,
  containerRadius: 20,
  containerPadding: 12,
  tabHeight: 32,
  inputMinHeight: 44,
  inputMaxHeight: 160,
  conversationMaxHeight: 380,
  pillRadius: 9999,
  circleSize: 36,
  circleGap: 8,
} as const

// ─── Animation ───

export const motion = {
  spring: { type: 'spring' as const, stiffness: 500, damping: 30 },
  easeOut: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const },
  fadeIn: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.15 },
  },
} as const
