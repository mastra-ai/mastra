import tailwindConfig from '../../../tailwind.config.ts';

export default {
  ...tailwindConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx,html}', '../../shared/**/*.{js,ts,jsx,tsx,html}'],
};
