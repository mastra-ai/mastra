import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0a1628',
          mid: '#132240',
          light: '#1c3158',
        },
        cream: {
          DEFAULT: '#f5f0e8',
          dark: '#e8e0d0',
        },
        gold: {
          DEFAULT: '#c8a55a',
          dim: '#a08040',
        },
      },
      fontFamily: {
        serif: ['Instrument Serif', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'subtle-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200, 165, 90, 0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(200, 165, 90, 0.12)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'subtle-pulse': 'subtle-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
