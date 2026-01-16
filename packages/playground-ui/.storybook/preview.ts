import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import './tailwind.css';
import { Colors } from '@/ds/tokens/colors';

const preview: Preview = {
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
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: Colors.surface1 },
        light: { name: 'Light', value: Colors.surface1 },
      },
    },
  },
  initialGlobals: {
    // 👇 Set the initial background color
    backgrounds: { value: 'dark' },
  },
};

export default preview;
