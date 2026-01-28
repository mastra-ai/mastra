import type { Config } from 'tailwindcss';
import baseConfig from '../tailwind.config';

export default {
  ...baseConfig,
  content: ['../src/**/*.{js,ts,jsx,tsx,html}', './**/*.{js,ts,jsx,tsx,mdx}'],
} satisfies Config;
