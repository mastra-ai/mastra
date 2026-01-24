import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface1: 'var(--surface1)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        surface4: 'var(--surface4)',
        surface5: 'var(--surface5)',
        neutral1: 'var(--neutral1)',
        neutral2: 'var(--neutral2)',
        neutral3: 'var(--neutral3)',
        neutral6: 'var(--neutral6)',
        neutral9: 'var(--neutral9)',
        accent1: 'var(--accent1)',
        accent2: 'var(--accent2)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
