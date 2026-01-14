import type { Config } from 'tailwindcss';
import defaultFont from 'tailwindcss/defaultTheme';
import {
  FontSizes,
  LineHeights,
  IconColors,
  BorderColors,
  Colors,
  BorderRadius,
  BorderWidth,
  Spacings,
  Sizes,
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
      borderWidth: {
        ...BorderWidth,
      },
      padding: {
        ...Spacings,
      },
      margin: {
        ...Spacings,
      },
      gap: {
        ...Spacings,
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
        ...IconColors,
        ...BorderColors,
      },
      fontFamily: {
        serif: ['var(--tasa-explorer)', ...defaultFont.fontFamily.serif],
        mono: ['var(--geist-mono)', ...defaultFont.fontFamily.mono],
        sans: ['var(--font-inter)', ...defaultFont.fontFamily.sans],
      },
      animation: {
        ripple: 'ripple var(--duration,2s) ease calc(var(--i, 0)*.2s) infinite',
        'icon-right': 'animate-icon-right ease-out 250ms',
        'typing-dot-bounce': 'typing-dot-bounce 1.4s infinite ease-in-out',
        'fade-in': 'fade-in 1s ease-out',
      },
      keyframes: {
        ripple: {
          '0%, 100%': {
            transform: 'translate(-50%, -50%) scale(1)',
          },
          '50%': {
            transform: 'translate(-50%, -50%) scale(0.9)',
          },
        },
        'animate-icon-right': {
          '0%': {
            transform: 'translateX(-6px)',
          },
          '100%': {
            transform: 'translateX(0px)',
          },
        },
        'typing-dot-bounce': {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-4px)',
          },
        },
        'fade-in': {
          '0%': {
            opacity: '0.8',
            backgroundColor: '#1A1A1A',
          },
          '100%': {
            opacity: '1',
            backgroundColor: 'transparent',
          },
        },
      },
    },
  },
  plugins: [animate, assistantUi, containerQueries],
} satisfies Config;
