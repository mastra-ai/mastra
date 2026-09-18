import type { Meta, StoryObj } from '@storybook/react-vite';
import { Status } from './status';
import { Txt } from '@/ds/components/Txt';

const RUNNING = {
  label: 'Running',
  tone: 'success',
  description: 'The server is live and responding to requests.',
} as const;

const meta: Meta<typeof Status> = {
  title: 'Feedback/StatusIndicators',
  component: Status,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Status labels use ui-xs by default because they occupy the meta/badge level in the Marvin text hierarchy. Pass text through children when the surrounding context requires another Txt role.',
      },
    },
  },
  args: {
    presentation: RUNNING,
  },
  argTypes: {
    children: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TextSlot: Story = {
  render: () => (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">Status text hierarchy</h1>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="ui-sm" className="text-neutral3 w-24">
          Meta
        </Txt>
        <Status presentation={RUNNING} />
      </div>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="ui-sm" className="text-neutral3 w-24">
          Secondary
        </Txt>
        <Status presentation={RUNNING}>
          <Txt as="span" variant="ui-sm">
            {RUNNING.label}
          </Txt>
        </Status>
      </div>
    </main>
  ),
};
