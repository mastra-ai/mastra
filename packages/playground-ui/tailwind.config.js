/** @type {import('tailwindcss').Config} */

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js, tsx, ts, jsx}'],
  theme: {
    extend: {
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
    require('@assistant-ui/react/tailwindcss'),
    require('@assistant-ui/react-markdown/tailwindcss'),
  ],
};
