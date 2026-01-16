import type { StorybookConfig } from '@storybook/react-vite';

import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Ensure Tailwind CSS is processed and modules are properly resolved
  viteFinal: async config => {
    // Add CSS processing
    config.css = {
      ...config.css,
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    };

    // Force all modules to be treated as internal
    config.define = {
      ...config.define,
      'process.env.NODE_ENV': '"production"',
    };

    // Ensure proper base URL for production builds
    config.base = './';

    return config;
  },
};

export default config;
