import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Ensure modules are properly resolved
  viteFinal: async config => {
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
