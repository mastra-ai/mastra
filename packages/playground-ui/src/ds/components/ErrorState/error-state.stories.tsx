import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorState } from './ErrorState';

const meta: Meta<typeof ErrorState> = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {
    title: 'Failed to load agents',
    message: 'Network request failed',
  },
};

export const ServerError: Story = {
  args: {
    title: 'Failed to load workflows',
    message: 'Internal server error (500)',
  },
};

export const Timeout: Story = {
  args: {
    title: 'Failed to load MCP servers',
    message: 'Request timed out after 30s',
  },
};
