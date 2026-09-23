import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SessionExpired } from './session-expired';

const meta: Meta<typeof SessionExpired> = {
  title: 'Domains/Auth/SessionExpired',
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

export const Fill: Story = {
  args: { variant: 'fill' },
  render: args => (
    <div className="h-120 border border-dashed border-border">
      <SessionExpired {...args} />
    </div>
  ),
};
