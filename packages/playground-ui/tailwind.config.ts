import type { Config } from 'tailwindcss';
import defaultFont from 'tailwindcss/defaultTheme';
import {
  FontSizes,
  LineHeights,
  BorderColors,
  Colors,
  BorderRadius,
  Spacings,
  Sizes,
  Animations,
  Shadows,
  Glows,
} from './src/ds/tokens';
import animate from 'tailwindcss-animate';
import assistantUi from '@assistant-ui/react-ui/tailwindcss';
import containerQueries from '@tailwindcss/container-queries';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,tsx,ts,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    spacing: Spacings,
    extend: {
      screens: {
        '3xl': '1900px',
        '4xl': '2000px',
      },
      fontSize: {
        ...FontSizes,
      },
      lineHeight: {
        ...LineHeights,
      },
      borderRadius: {
        ...BorderRadius,
      },
      height: {
        ...Sizes,
      },
      maxHeight: {
        ...Sizes,
      },
      width: {
        ...Sizes,
      },
      maxWidth: {
        ...Sizes,
      },
      colors: {
        ...Colors,
        ...BorderColors,
      },
      fontFamily: {
        serif: ['var(--tasa-explorer)', ...defaultFont.fontFamily.serif],
        mono: ['var(--geist-mono)', ...defaultFont.fontFamily.mono],
        sans: ['var(--font-inter)', ...defaultFont.fontFamily.sans],
      },
      // Animation tokens
      transitionDuration: {
        normal: Animations.durationNormal,
        slow: Animations.durationSlow,
      },
      transitionTimingFunction: {
        'ease-out-custom': Animations.easeOut,
      },
      // Shadow tokens
      boxShadow: {
        sm: Shadows.sm,
        md: Shadows.md,
        lg: Shadows.lg,
        inner: Shadows.inner,
        card: Shadows.card,
        elevated: Shadows.elevated,
        dialog: Shadows.dialog,
        'glow-accent1': Glows.accent1,
        'glow-accent2': Glows.accent2,
        'focus-ring': Glows.focusRing,
      },
      // Custom keyframes
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [animate, assistantUi, containerQueries],
} satisfies Config;
