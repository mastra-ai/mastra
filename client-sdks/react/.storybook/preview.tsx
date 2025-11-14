import React from 'react';
import '../src/ui/index.css';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    Story => {
      // 👇 Make it configurable by reading from parameters

      return (
        <div
          style={{ backgroundColor: '#0F0F0F', height: '100vh', width: '100%', padding: 48 }}
          id="page-layout-default"
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
