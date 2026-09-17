import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
    getAbsolutePath('@storybook/addon-a11y'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: config =>
    mergeConfig(config, {
      // Workspace-linked core dist files are otherwise served as source and fed to
      // react-docgen, which cannot parse them; pre-bundling skips that transform.
      optimizeDeps: {
        include: ['@mastra/core/observability'],
      },
      resolve: {
        alias: [
          {
            find: /^@mastra\/react$/,
            replacement: fileURLToPath(new URL('./mocks/mastra-react.ts', import.meta.url)),
          },
        ],
      },
    }),
};

export default config;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
