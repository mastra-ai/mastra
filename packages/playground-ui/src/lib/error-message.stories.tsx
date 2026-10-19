import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCwIcon } from 'lucide-react';

import { errorToast } from './error-message';
import type { ErrorMessage } from './error-message';
import { ErrorNotice } from './error-notice';
import { Toaster } from './toast';
import { Button } from '@/ds/components/Button';

const deleteDatabase: ErrorMessage = {
  title: 'Couldn’t delete orders-db',
  why: 'Two environments still use it.',
  reassurance: 'Nothing was deleted.',
  fix: 'Detach it from both environments, then delete it.',
  wayOut: { kind: 'docs', href: 'https://mastra.ai/docs' },
};

const loadDeploys: ErrorMessage = {
  title: 'Couldn’t load deploys',
  why: 'The server returned an error.',
  reassurance: 'Running deploys aren’t affected.',
  fix: 'Retry, or contact support if it keeps happening.',
  wayOut: { kind: 'support', href: 'https://mastra.ai/contact' },
};

const unlinkSlack: ErrorMessage = {
  title: 'Couldn’t unlink Slack',
  why: 'The connection didn’t respond.',
  fix: 'Try again in a minute.',
};

const meta: Meta<typeof ErrorNotice> = {
  title: 'Feedback/Error message',
  component: ErrorNotice,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-200 rounded-lg bg-background p-6">
        <Toaster position="bottom-right" />
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ErrorNotice>;

export const Notices: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <ErrorNotice message={deleteDatabase} />
      <ErrorNotice
        message={loadDeploys}
        action={
          <Button size="sm" icon={<RefreshCwIcon />}>
            Retry
          </Button>
        }
      />
      <ErrorNotice message={unlinkSlack} />
    </div>
  ),
};

export const Toasts: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => errorToast(unlinkSlack)}>Unlink Slack</Button>
      <Button onClick={() => errorToast(deleteDatabase)}>Delete orders-db</Button>
      <Button
        onClick={() => errorToast(loadDeploys, { action: { label: 'Retry', onClick: () => errorToast(loadDeploys) } })}
      >
        Load deploys
      </Button>
    </div>
  ),
};
