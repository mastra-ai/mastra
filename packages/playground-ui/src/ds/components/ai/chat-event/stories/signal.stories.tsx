import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ChatSignal } from '../chat-signal';

const meta = {
  title: 'AI/Chat events/Signal',
  component: ChatSignal,
  args: {
    kind: 'state',
    label: 'State snapshot: factory-phase',
    message: 'Board: work\nStage: building\nRevision: 4',
    variant: 'row',
  },
  argTypes: {
    kind: { control: 'select', options: ['state', 'reactive', 'reminder'] },
    variant: { control: 'inline-radio', options: ['row', 'card'] },
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'State, reactive and reminder presentation. Factory uses compact rows; Studio uses cards for state and reactive signals. Filtering hidden control signals and pinned task data stays in the consuming adapter.',
      },
    },
  },
} satisfies Meta<typeof ChatSignal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const State: Story = {};
export const Expanded: Story = { args: { defaultOpen: true } };
export const Reactive: Story = {
  args: {
    kind: 'reactive',
    label: 'Work item feed',
    message: 'Damien: Keep the attachment previews when updating the composer.',
  },
};
export const Reminder: Story = {
  args: {
    kind: 'reminder',
    label: 'System reminder',
    message: 'Run the relevant checks before submitting the change.',
  },
};
export const StateCard: Story = {
  args: {
    variant: 'card',
    label: 'workspace',
    mode: 'snapshot',
    message: 'Branch: composer-review\nThe workspace is ready.',
  },
};
export const ReactiveCard: Story = {
  args: { variant: 'card', kind: 'reactive', label: 'files-changed', message: 'src/chat/composer.tsx was updated.' },
};
export const NoDetails: Story = {
  args: { message: '' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};
