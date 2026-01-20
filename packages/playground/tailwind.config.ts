import type { Config } from 'tailwindcss';

export default {
  presets: [require('@mastra/playground-ui/tailwind-preset')],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,html}',
    './node_modules/@mastra/playground-ui/dist/**/*.{js,ts,jsx,tsx,css}',
  ],
} satisfies Config;
