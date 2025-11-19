import type { StorybookConfig } from '@storybook/react-vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

import { join, dirname } from 'path';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  viteFinal: async config => {
    // Add Tailwind CSS plugin
    config.plugins = config.plugins || [];

    return config;
  },
};
export default config;
