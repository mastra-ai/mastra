import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    './stories/**/*.stories.tsx',
    '../../playground/.storybook/**/*.stories.tsx',
    '../../../mastracode/factory-ui/.storybook/**/*.stories.tsx',
  ],
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
      resolve: {
        dedupe: ['react', 'react-dom'],
        alias: [
          {
            find: /^@mastra\/playground-ui\/components\/(.+)$/,
            replacement: fileURLToPath(new URL('../src/ds/components/$1', import.meta.url)),
          },
          {
            find: /^@mastra\/playground-ui\/icons\/(.+)$/,
            replacement: fileURLToPath(new URL('../src/ds/icons/$1', import.meta.url)),
          },
          {
            find: /^@mastra\/playground-ui\/utils\/(.+)$/,
            replacement: fileURLToPath(new URL('../src/utils/$1', import.meta.url)),
          },
          {
            find: /^@mastra\/playground-ui\/hooks\/(.+)$/,
            replacement: fileURLToPath(new URL('../src/hooks/$1', import.meta.url)),
          },
          { find: 'storybook/test', replacement: fileURLToPath(import.meta.resolve('storybook/test')) },
          {
            find: /^@mastra\/react$/,
            replacement: fileURLToPath(new URL('./mocks/mastra-react.ts', import.meta.url)),
          },
        ],
      },
    }),
};

export default config;

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
