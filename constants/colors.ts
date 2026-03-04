export const Colors = {
  // ─── Base (light green + white) ───────────────────────────────────────────
  background: '#F5FAF6',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#EDF7F0',
  cardBorder: '#C8E6D0',

  // ─── Brand (forest green) ─────────────────────────────────────────────────
  primary: '#2E8B57',
  primaryLight: '#4CAF75',
  primaryDark: '#1E6B40',
  primaryAlpha: 'rgba(46, 139, 87, 0.12)',

  // ─── Semantic ─────────────────────────────────────────────────────────────
  success: '#2E8B57',
  successLight: '#4CAF75',
  successAlpha: 'rgba(46, 139, 87, 0.12)',

  danger: '#DC3545',
  dangerLight: '#F06B77',
  dangerAlpha: 'rgba(220, 53, 69, 0.10)',

  warning: '#D4820E',
  warningLight: '#F0A832',
  warningAlpha: 'rgba(212, 130, 14, 0.12)',

  info: '#1A7FC1',
  infoAlpha: 'rgba(26, 127, 193, 0.12)',

  // ─── Text (dark on light background) ─────────────────────────────────────
  textPrimary: '#1A3025',
  textSecondary: '#3D6B4F',
  textMuted: '#7A9F85',
  textInverse: '#FFFFFF',

  // ─── Borders ──────────────────────────────────────────────────────────────
  border: '#C8E6D0',
  borderLight: '#E0F2E8',

  // ─── Overlays ─────────────────────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.15)',

  // ─── Gradients (as arrays for LinearGradient) ─────────────────────────────
  gradients: {
    primary: ['#2E8B57', '#1E6B40'] as const,
    success: ['#2E8B57', '#1E6B40'] as const,
    danger: ['#DC3545', '#B52535'] as const,
    warning: ['#D4820E', '#A86008'] as const,
    card: ['#FFFFFF', '#EDF7F0'] as const,
    dark: ['#F5FAF6', '#E8F5EC'] as const,
    swipeRight: ['rgba(46, 139, 87, 0.92)', 'rgba(30, 107, 64, 0.75)'] as const,
    swipeLeft: ['rgba(220, 53, 69, 0.92)', 'rgba(181, 37, 53, 0.75)'] as const,
    swipeUp: ['rgba(212, 130, 14, 0.92)', 'rgba(168, 96, 8, 0.75)'] as const,
  },

  // ─── Swipe Labels ─────────────────────────────────────────────────────────
  apply: '#2E8B57',
  skip: '#DC3545',
  save: '#D4820E',
} as const;

export type ColorKey = keyof typeof Colors;
