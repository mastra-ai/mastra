import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xs: '0.3125rem',
      },
      colors: {
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
        'dialog-bg': 'rgb(34, 34, 34)',

        // shadcn colors
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      backdropBlur: {
        '4xl': '120px',
      },
      backgroundImage: {
        'gradient-radial': 'linear-gradient(90deg, rgba(95, 120, 62, 0.05) 0%, rgba(153, 153, 153, 0.00) 100%)',
      },
      borderColor: {
        gray: { 6: 'hsla(0, 0%, 60%, 20%)' },
      },
      borderWidth: {
        thin: '0.5px',
      },
      fontSize: {
        small: '0.8125rem',
        base: 'calc(13/16 * 1rem)',
        '2xs': 'calc(11/16 * 1rem)',
      },
      keyframes: {
        'typing-dot-bounce': {
          '0%,40%': {
            transform: 'translateY(0)',
          },
          '20%': {
            transform: 'translateY(-0.25rem)',
          },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'typing-dot-bounce': 'typing-dot-bounce 1.25s ease-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
} satisfies Config;
