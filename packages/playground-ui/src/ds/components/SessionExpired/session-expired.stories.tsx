import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SessionExpired } from './SessionExpired';

const meta: Meta<typeof SessionExpired> = {
  title: 'Feedback/SessionExpired',
  component: SessionExpired,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <MastraReactProvider baseUrl="http://localhost:4111">
        <Story />
      </MastraReactProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SessionExpired>;

export const Default: Story = {};

export const CustomCopy: Story = {
  args: {
    title: 'Sign in to continue',
    description: 'Your Studio session ended while this page was open.',
  },
};
