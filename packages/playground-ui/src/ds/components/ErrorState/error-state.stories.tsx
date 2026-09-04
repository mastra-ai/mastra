import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { ErrorState } from './ErrorState';

const meta: Meta<typeof ErrorState> = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Unable to load traces',
    message: 'The observability store did not respond. Check the connection and try again.',
  },
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {};

export const WithRecoveryAction: Story = {
  args: {
    action: <Button onClick={fn()}>Try again</Button>,
  },
};
