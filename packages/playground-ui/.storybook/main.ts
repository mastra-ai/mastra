import type { StorybookConfig } from '@storybook/react-vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Ensure Tailwind CSS is processed and modules are properly resolved
  viteFinal: async config => {
    // Add resolve configuration to handle module resolution
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': resolve(__dirname, '../src'),
        // Force Radix UI modules to be resolved from node_modules
        '@radix-ui/react-hover-card': resolve(__dirname, '../node_modules/@radix-ui/react-hover-card/dist/index.js'),
        '@radix-ui/react-alert-dialog': resolve(
          __dirname,
          '../node_modules/@radix-ui/react-alert-dialog/dist/index.js',
        ),
        '@radix-ui/react-avatar': resolve(__dirname, '../node_modules/@radix-ui/react-avatar/dist/index.js'),
        '@radix-ui/react-checkbox': resolve(__dirname, '../node_modules/@radix-ui/react-checkbox/dist/index.js'),
        '@radix-ui/react-collapsible': resolve(__dirname, '../node_modules/@radix-ui/react-collapsible/dist/index.js'),
        '@radix-ui/react-dialog': resolve(__dirname, '../node_modules/@radix-ui/react-dialog/dist/index.js'),
        '@radix-ui/react-label': resolve(__dirname, '../node_modules/@radix-ui/react-label/dist/index.js'),
        '@radix-ui/react-popover': resolve(__dirname, '../node_modules/@radix-ui/react-popover/dist/index.js'),
        '@radix-ui/react-radio-group': resolve(__dirname, '../node_modules/@radix-ui/react-radio-group/dist/index.js'),
        '@radix-ui/react-scroll-area': resolve(__dirname, '../node_modules/@radix-ui/react-scroll-area/dist/index.js'),
        '@radix-ui/react-select': resolve(__dirname, '../node_modules/@radix-ui/react-select/dist/index.js'),
        '@radix-ui/react-slider': resolve(__dirname, '../node_modules/@radix-ui/react-slider/dist/index.js'),
        '@radix-ui/react-slot': resolve(__dirname, '../node_modules/@radix-ui/react-slot/dist/index.js'),
        '@radix-ui/react-switch': resolve(__dirname, '../node_modules/@radix-ui/react-switch/dist/index.js'),
        '@radix-ui/react-tabs': resolve(__dirname, '../node_modules/@radix-ui/react-tabs/dist/index.js'),
        '@radix-ui/react-toggle': resolve(__dirname, '../node_modules/@radix-ui/react-toggle/dist/index.js'),
        '@radix-ui/react-tooltip': resolve(__dirname, '../node_modules/@radix-ui/react-tooltip/dist/index.js'),
        '@radix-ui/react-visually-hidden': resolve(
          __dirname,
          '../node_modules/@radix-ui/react-visually-hidden/dist/index.js',
        ),
        // Force lucide-react to be resolved from node_modules
        'lucide-react': resolve(__dirname, '../node_modules/lucide-react/dist/esm/lucide-react.js'),
      },
    };

    // Ensure external dependencies are properly handled
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include || []),
        // Radix UI packages used in playground-ui
        '@radix-ui/react-hover-card',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-avatar',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-dialog',
        '@radix-ui/react-label',
        '@radix-ui/react-popover',
        '@radix-ui/react-radio-group',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-select',
        '@radix-ui/react-slider',
        '@radix-ui/react-slot',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toggle',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-visually-hidden',
        // Other dependencies
        'react',
        'react-dom',
        'lucide-react',
        'tailwindcss',
        'autoprefixer',
      ],
      exclude: [...(config.optimizeDeps?.exclude || [])],
    };

    // Add CSS processing
    config.css = {
      ...config.css,
      postcss: {
        plugins: [tailwindcss(resolve(__dirname, './tailwind.config.ts')), autoprefixer()],
      },
    };

    // Force bundling of all modules
    config.ssr = {
      ...config.ssr,
      noExternal: ['@radix-ui/*', 'lucide-react'],
    };

    // Ensure proper bundling for production builds
    config.build = {
      ...config.build,
      rollupOptions: {
        ...config.build?.rollupOptions,
        // Don't externalize any modules - bundle everything
        external: (id: string) => {
          // Don't externalize Radix UI packages
          if (id.startsWith('@radix-ui/')) {
            return false;
          }
          // Don't externalize lucide-react
          if (id === 'lucide-react') {
            return false;
          }
          return false;
        },
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
