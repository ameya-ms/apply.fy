export const Colors = {
  // ─── Base ─────────────────────────────────────────────────────────────────
  background: '#0A0A0F',
  surface: '#13131F',
  card: '#1C1C2E',
  cardElevated: '#252540',
  cardBorder: '#2E2E48',

  // ─── Brand ────────────────────────────────────────────────────────────────
  primary: '#7C6CF0',
  primaryLight: '#A599F5',
  primaryDark: '#5547C9',
  primaryAlpha: 'rgba(124, 108, 240, 0.15)',

  // ─── Semantic ─────────────────────────────────────────────────────────────
  success: '#00D4AA',
  successLight: '#4DFFE0',
  successAlpha: 'rgba(0, 212, 170, 0.15)',

  danger: '#FF4B6E',
  dangerLight: '#FF8099',
  dangerAlpha: 'rgba(255, 75, 110, 0.15)',

  warning: '#FFD166',
  warningLight: '#FFE5A0',
  warningAlpha: 'rgba(255, 209, 102, 0.15)',

  info: '#4FC3F7',
  infoAlpha: 'rgba(79, 195, 247, 0.15)',

  // ─── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#FFFFFF',
  textSecondary: '#9090AA',
  textMuted: '#606078',
  textInverse: '#0A0A0F',

  // ─── Borders ──────────────────────────────────────────────────────────────
  border: '#2A2A3E',
  borderLight: '#3A3A52',

  // ─── Overlays ─────────────────────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // ─── Gradients (as arrays for LinearGradient) ─────────────────────────────
  gradients: {
    primary: ['#7C6CF0', '#5547C9'] as const,
    success: ['#00D4AA', '#00A884'] as const,
    danger: ['#FF4B6E', '#CC2A4C'] as const,
    warning: ['#FFD166', '#FFA500'] as const,
    card: ['#1C1C2E', '#252540'] as const,
    dark: ['#0A0A0F', '#13131F'] as const,
    swipeRight: ['rgba(0, 212, 170, 0.9)', 'rgba(0, 168, 132, 0.7)'] as const,
    swipeLeft: ['rgba(255, 75, 110, 0.9)', 'rgba(204, 42, 76, 0.7)'] as const,
    swipeUp: ['rgba(255, 209, 102, 0.9)', 'rgba(255, 165, 0, 0.7)'] as const,
  },

  // ─── Swipe Labels ─────────────────────────────────────────────────────────
  apply: '#00D4AA',
  skip: '#FF4B6E',
  save: '#FFD166',
} as const;

export type ColorKey = keyof typeof Colors;
