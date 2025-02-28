/** @type {import('tailwindcss').Config} */

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js, tsx, ts, jsx}'],
  theme: {},
  plugins: [
    require('tailwindcss-animate'),
    require('@assistant-ui/react/tailwindcss'),
    require('@assistant-ui/react-markdown/tailwindcss'),
  ],
};
