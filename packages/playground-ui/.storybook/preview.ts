import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import './tailwind.css';

// The three canvas steps of the product, in the order a screen stacks them:
// `background-1` is the sidebar rail, `background-2` the page a route renders
// on, `background-3` the raised material a card or a field is made of. Each
// resolves per theme, so one value covers both.
const surfaces = {
  'background-1': { name: 'Background 1 — rail', value: 'var(--background-1)' },
  'background-2': { name: 'Background 2 — page', value: 'var(--background-2)' },
  'background-3': { name: 'Background 3 — raised', value: 'var(--background-3)' },
};

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Studio theme',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'light', title: 'Light', icon: 'sun' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals?.theme === 'light' ? 'light' : 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      return Story();
    },
  ],
  parameters: {
    docs: {
      theme: themes.dark,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { options: surfaces },
  },
  initialGlobals: {
    theme: 'dark',
    backgrounds: { value: 'background-2' },
  },
};

export default preview;
