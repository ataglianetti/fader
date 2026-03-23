/**
 * Fader Theme Loader
 *
 * Loads theme JSON files and maps their simplified 16-token palettes
 * to the full ~50-token ColorPalette that the existing CSS sync expects.
 */

import type { ColorPalette } from './theme'

// ─── Theme JSON types (matches themes/schema.json) ───

export interface FaderColorScheme {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  accent: string
  accentHover: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  success: string
  error: string
  warning: string
  border: string
  borderActive: string
  codeBlockBg: string
  selection: string
  scrollbarThumb?: string
  scrollbarTrack?: string
}

export interface FaderTheme {
  name: string
  id: string
  version: string
  author?: string
  license?: string
  defaultMode?: 'dark' | 'light' | 'system'
  branding?: {
    logo?: string
    windowTitle?: string
    welcomeMessage?: string
  }
  typography: {
    fontFamily: string
    fontMono: string
    fontSize: string
    lineHeight?: string
  }
  dark: FaderColorScheme
  light: FaderColorScheme
}

// ─── Color utilities ───

/** Parse hex color to RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{6})$/i)
  if (!match) return null
  const n = parseInt(match[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

/** Create rgba string from hex + alpha */
function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** Lighten a hex color by a factor (0-1) */
function lighten(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor))
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor))
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Darken a hex color by a factor (0-1) */
function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const r = Math.round(rgb.r * (1 - factor))
  const g = Math.round(rgb.g * (1 - factor))
  const b = Math.round(rgb.b * (1 - factor))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ─── Token resolver ───

/**
 * Maps a simplified 16-token theme palette to the full ~50-token ColorPalette
 * that the existing CLUI CSS sync expects.
 */
export function resolveTokens(scheme: FaderColorScheme, isDark: boolean): ColorPalette {
  const hoverOverlay = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
  const activeOverlay = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'

  // Derive intermediate surface from bg
  const bgMid = isDark ? lighten(scheme.bgPrimary, 0.08) : darken(scheme.bgPrimary, 0.03)

  return {
    // Container (glass surfaces)
    containerBg: scheme.bgPrimary,
    containerBgCollapsed: isDark ? darken(scheme.bgPrimary, 0.05) : darken(scheme.bgPrimary, 0.02),
    containerBorder: scheme.border,
    containerShadow: isDark
      ? '0 8px 28px rgba(0, 0, 0, 0.35), 0 1px 6px rgba(0, 0, 0, 0.25)'
      : '0 8px 28px rgba(0, 0, 0, 0.08), 0 1px 6px rgba(0, 0, 0, 0.04)',
    cardShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
    cardShadowCollapsed: isDark ? '0 2px 6px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.08)',

    // Surface layers
    surfacePrimary: scheme.bgSecondary,
    surfaceSecondary: scheme.bgTertiary,
    surfaceHover: hoverOverlay,
    surfaceActive: activeOverlay,

    // Input
    inputBg: 'transparent',
    inputBorder: scheme.border,
    inputFocusBorder: rgba(scheme.accent, 0.4),
    inputPillBg: isDark ? bgMid : '#ffffff',

    // Text
    textPrimary: scheme.textPrimary,
    textSecondary: scheme.textSecondary,
    textTertiary: scheme.textMuted,
    textMuted: scheme.border,

    // Accent
    accent: scheme.accent,
    accentLight: rgba(scheme.accent, 0.1),
    accentSoft: rgba(scheme.accent, isDark ? 0.15 : 0.12),

    // Status dots
    statusIdle: scheme.textMuted,
    statusRunning: scheme.accent,
    statusRunningBg: rgba(scheme.accent, 0.1),
    statusComplete: scheme.success,
    statusCompleteBg: rgba(scheme.success, 0.1),
    statusError: scheme.error,
    statusErrorBg: rgba(scheme.error, isDark ? 0.08 : 0.06),
    statusDead: scheme.error,
    statusPermission: scheme.accent,
    statusPermissionGlow: rgba(scheme.accent, isDark ? 0.4 : 0.3),

    // Tab
    tabActive: scheme.bgSecondary,
    tabActiveBorder: scheme.border,
    tabInactive: 'transparent',
    tabHover: hoverOverlay,

    // User message bubble
    userBubble: scheme.bgSecondary,
    userBubbleBorder: scheme.border,
    userBubbleText: scheme.textPrimary,

    // Tool card
    toolBg: scheme.bgSecondary,
    toolBorder: scheme.border,
    toolRunningBorder: rgba(scheme.accent, 0.3),
    toolRunningBg: rgba(scheme.accent, 0.05),

    // Timeline
    timelineLine: scheme.bgSecondary,
    timelineNode: rgba(scheme.accent, 0.2),
    timelineNodeActive: scheme.accent,

    // Scrollbar
    scrollThumb: scheme.scrollbarThumb || (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'),
    scrollThumbHover: scheme.scrollbarThumb
      ? (isDark ? lighten(scheme.scrollbarThumb, 0.15) : darken(scheme.scrollbarThumb, 0.1))
      : (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'),

    // Stop button
    stopBg: scheme.error,
    stopHover: darken(scheme.error, 0.15),

    // Send button
    sendBg: scheme.accent,
    sendHover: scheme.accentHover,
    sendDisabled: rgba(scheme.accent, 0.3),

    // Popover
    popoverBg: isDark ? lighten(scheme.bgPrimary, 0.04) : scheme.bgPrimary,
    popoverBorder: scheme.border,
    popoverShadow: isDark
      ? '0 4px 20px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)'
      : '0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',

    // Code block
    codeBg: scheme.codeBlockBg,

    // Mic button
    micBg: scheme.bgSecondary,
    micColor: scheme.textSecondary,
    micDisabled: scheme.bgTertiary,

    // Placeholder
    placeholder: isDark ? lighten(scheme.textMuted, 0.1) : darken(scheme.textMuted, 0.1),

    // Disabled button color
    btnDisabled: scheme.bgTertiary,

    // Text on accent backgrounds
    textOnAccent: '#ffffff',

    // Button hover
    btnHoverColor: scheme.textSecondary,
    btnHoverBg: scheme.bgSecondary,

    // Accent border variants
    accentBorder: rgba(scheme.accent, 0.19),
    accentBorderMedium: rgba(scheme.accent, 0.25),

    // Permission card (amber/warning)
    permissionBorder: rgba(scheme.warning, 0.3),
    permissionShadow: `0 2px 12px ${rgba(scheme.warning, 0.08)}`,
    permissionHeaderBg: rgba(scheme.warning, 0.06),
    permissionHeaderBorder: rgba(scheme.warning, 0.12),

    // Permission allow (green/success)
    permissionAllowBg: rgba(scheme.success, 0.1),
    permissionAllowHoverBg: rgba(scheme.success, 0.22),
    permissionAllowBorder: rgba(scheme.success, 0.25),

    // Permission deny (red/error)
    permissionDenyBg: rgba(scheme.error, 0.08),
    permissionDenyHoverBg: rgba(scheme.error, 0.18),
    permissionDenyBorder: rgba(scheme.error, 0.22),

    // Permission denied card
    permissionDeniedBorder: rgba(scheme.error, 0.3),
    permissionDeniedHeaderBorder: rgba(scheme.error, 0.12),
  } as ColorPalette
}

/** Apply typography CSS custom properties from theme */
export function applyTypography(theme: FaderTheme): void {
  const style = document.documentElement.style
  style.setProperty('--fader-font-family', theme.typography.fontFamily)
  style.setProperty('--fader-font-mono', theme.typography.fontMono)
  style.setProperty('--fader-font-size', theme.typography.fontSize)
  style.setProperty('--fader-line-height', theme.typography.lineHeight || '1.6')
}

/** Load all available themes via IPC */
export async function loadThemes(): Promise<FaderTheme[]> {
  try {
    return await (window as any).clui.listThemes()
  } catch {
    return []
  }
}
