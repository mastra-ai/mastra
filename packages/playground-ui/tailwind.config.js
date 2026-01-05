/** @type {import('tailwindcss').Config} */

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js, tsx, ts, jsx}'],
  theme: {
    extend: {
      colors: {
        mastra: {
          'bg-1': '#121212',
          'bg-2': '#171717',
          'bg-3': '#1a1a1a',
          'bg-4': '#262626',
          'bg-5': '#2e2e2e',
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
          'border-destructive': 'hsl(3deg, 72.4%, 51.6%)',
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
      animation: {
        'fade-in': 'fade-in 1s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': {
            opacity: '0.8',
            backgroundColor: 'hsl(var(--muted))',
          },
          '100%': {
            opacity: '1',
            backgroundColor: 'transparent',
          },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@assistant-ui/react-ui/tailwindcss'),
    require('@tailwindcss/container-queries'),
  ],
};
