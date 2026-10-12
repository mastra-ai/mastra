import type { Meta, StoryObj } from '@storybook/react-vite';
import { TracesListView } from './traces-list-view';

const meta = {
  title: 'Domains/Traces/StoredPreviews',
  component: TracesListView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div style={{ height: '80vh', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onTraceClick: () => {},
    columnPreferences: {
      visibleColumns: ['input', 'output', 'error', 'duration'],
      customColumns: [],
      metadataKeys: [],
    },
    traces: [
      {
        traceId: 'preview',
        name: 'Weather agent',
        createdAt: '2026-10-12T10:00:00Z',
        startedAt: '2026-10-12T10:00:00Z',
        endedAt: '2026-10-12T10:00:01Z',
        inputPreview: 'What is the weather in Berlin?',
        outputPreview: 'Cloudy with a high of 16°C.',
        status: 'success',
      },
      {
        traceId: 'legacy',
        name: 'Report agent',
        createdAt: '2026-10-12T09:00:00Z',
        inputPreview: 'Summarize this report.',
        errorPreview: 'Document could not be loaded.',
        status: 'error',
      },
    ],
  },
} satisfies Meta<typeof TracesListView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const OutputColumn: Story = {};
