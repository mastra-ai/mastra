import type { Meta, StoryObj } from '@storybook/react-vite';
import { Status } from './status';
import { DataList } from '@/ds/components/DataList';
import { Txt } from '@/ds/components/Txt';

const RUNNING = {
  label: 'Ready',
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
          'The label always inherits the surrounding text size and color, so it matches its siblings in a DataList cell, table row, card, or sentence. Style the container, not the status.',
      },
    },
  },
  args: {
    presentation: RUNNING,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inherited: Story = {
  render: () => (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">Status text inherits its container</h1>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="caption" tone="muted" className="w-40">
          Inside meta text
        </Txt>
        <span className="text-meta text-foreground">
          <Status presentation={RUNNING} />
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Txt as="span" variant="caption" tone="muted" className="w-40">
          Inside a muted row
        </Txt>
        <span className="text-body-sm text-muted-foreground">
          <Status presentation={RUNNING} />
        </span>
      </div>
    </main>
  ),
};

export const InContext: Story = {
  render: () => (
    <main className="w-160">
      <h1 className="sr-only">Status in context</h1>
      <DataList columns="1fr 7rem 7rem">
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Status</DataList.TopCell>
          <DataList.TopCell>Created</DataList.TopCell>
        </DataList.Top>
        <DataList.RowStatic>
          <DataList.TextCell font="mono">5a1cc833-666</DataList.TextCell>
          <DataList.Cell>
            <Status presentation={RUNNING} />
          </DataList.Cell>
          <DataList.TextCell>2 hours ago</DataList.TextCell>
        </DataList.RowStatic>
      </DataList>
    </main>
  ),
};
