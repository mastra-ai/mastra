import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-main':'#121212',
        'bg-window':'#171717',
        'bg-window-separation':'#1a1a1a',
        'bg-overlay':'#262626',
        'bg-dropdown':'#2e2e2e',
        'border-primary':'#343434',
        'border-secondary':'#424242',
        'text-light':'#ffffff',
        'text-dim':'#939393'
      }
    },
  },
  plugins: [],
};
export default config;
