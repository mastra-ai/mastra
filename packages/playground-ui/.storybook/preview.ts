import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import '../src/index.css'; // Import the correct Tailwind CSS
import '../../../packages/cli/src/playground/src/index.css';

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
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#1a1a1a',
        },
        {
          name: 'light',
          value: '#ffffff',
        },
      ],
    },
  },
  initialGlobals: {
    // 👇 Set the initial background color
    backgrounds: { value: 'dark' },
  },
};

export default preview;
