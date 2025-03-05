import type { Config } from 'tailwindcss';

import defaultFont from 'tailwindcss/defaultTheme';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,html}',
    './node_modules/@mastra/playground/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsla(var(--accent))',
          blue: 'hsla(var(--accent-blue))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          black: 'hsl(var(--sidebar-black))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        mastra: {
          'bg-1': '#121212', // used for main background
          'bg-2': '#171717', // used for view-windowed background
          'bg-3': '#1a1a1a', // sed for areas in view window that need separation
          'bg-4': '#262626', // overlay modal -> dialog e.t.c
          'bg-5': '#2e2e2e', // context menu, dropdown
          'bg-6': '#202020',
          'bg-7': '#5f5fc5',
          'bg-8': '#242424',
          'bg-9': '#2c2c2c',
          'bg-10': '#202020',
          'bg-11': '#232323',
          'bg-12': '#d9d9d908',
          'bg-13': '#1f1f1f',
          'bg-accent': '#5699a8',
          'bg-connected': '#6cd063',
          'border-1': '#343434',
          'border-2': '#424242',
          'border-3': '#3e3e3e',
          'border-4': '#a5a5f1',
          'border-5': '#5699a8',
          'border-6': '#212121',
          'border-7': '#2f2f2f',
          'border-destructive': 'hsl(3deg, 72.4%, 51.6%)', //colors should be hsl/oklch values
          'border-connected': '#6cd063',
          'el-1': '#5c5c5f',
          'el-2': '#707070',
          'el-3': '#939393',
          'el-4': '#a9a9a9',
          'el-5': '#e6e6e6',
          'el-6': '#ffffff',
          'el-accent': '#5f5fc5',
          'el-warning': '#F09A56',
          'el-connected': '#6cd063',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        serif: ['var(--tasa-explorer)', ...defaultFont.fontFamily.serif],
        mono: ['var(--commit-mono)', ...defaultFont.fontFamily.mono],
        sans: ['var(--font-inter)', ...defaultFont.fontFamily.sans],
      },
      animation: {
        ripple: 'ripple var(--duration,2s) ease calc(var(--i, 0)*.2s) infinite',
        'icon-right': 'animate-icon-right ease-out 250ms',
        'typing-dot-bounce': 'typing-dot-bounce 1.4s infinite ease-in-out',
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
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
