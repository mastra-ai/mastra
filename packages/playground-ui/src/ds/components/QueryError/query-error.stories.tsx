import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { QueryError } from './QueryError';

const meta: Meta<typeof QueryError> = {
  title: 'Feedback/QueryError',
  component: QueryError,
  parameters: { layout: 'fullscreen' },
  args: { title: 'Failed to load workflows', resource: 'workflows' },
  decorators: [
    Story => (
      <MastraReactProvider baseUrl="http://localhost:4111">
        <Story />
      </MastraReactProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QueryError>;

export const SessionExpired: Story = {
  args: { error: { status: 401 } },
};

export const PermissionDenied: Story = {
  args: { error: { status: 403 }, resource: 'production workflows' },
};

export const ServerFailure: Story = {
  args: { error: new Error('HTTP error! status: 500 - {"error":"the observability store is unreachable"}') },
};

export const WithRecoveryAction: Story = {
  args: {
    error: new Error('HTTP error! status: 503 - {"error":"the workflow service is restarting"}'),
    action: <Button onClick={fn()}>Try again</Button>,
  },
};
