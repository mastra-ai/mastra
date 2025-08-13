import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';
import '../src/index.css'; // Import Tailwind CSS
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
  },
  initialGlobals: {
    // 👇 Set the initial background color
    backgrounds: { value: 'dark' },
  },
};

export default preview;
