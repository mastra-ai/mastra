import type { Meta, StoryObj } from '@storybook/react-vite';
import { TraceKeysAndValues } from './trace-keys-and-values';

const meta = {
  title: 'Elements/TraceKeysAndValues',
  component: TraceKeysAndValues,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div className="w-screen max-w-3xl px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TraceKeysAndValues>;

export default meta;
type Story = StoryObj<typeof meta>;

const rootSpan = {
  entityId: 'mastra-docs-agent',
  entityName: 'Mastra Docs Agent',
  entityType: 'agent',
  startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
};

export const Default: Story = {
  args: {
    rootSpan: {
      ...rootSpan,
      endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
    },
  },
};

export const Running: Story = {
  args: {
    rootSpan,
  },
};

export const ResponsiveThreeColumns: Story = {
  args: {
    numOfCol: 3,
    rootSpan: {
      ...rootSpan,
      endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
    },
  },
};

export const ErrorStatus: Story = {
  name: 'Error',
  args: {
    rootSpan: {
      ...rootSpan,
      endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
      error: new Error('Trace failed'),
    },
  },
};
