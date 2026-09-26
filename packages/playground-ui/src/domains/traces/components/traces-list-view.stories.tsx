import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { TracesListView } from './traces-list-view';
import type { TracesListViewTrace } from './traces-list-view';

const minute = 60_000;

function trace(
  index: number,
  agent: string,
  agoMs: number,
  durationMs: number,
  status: 'success' | 'error' | 'running',
): TracesListViewTrace {
  const startedAt = new Date(Date.now() - agoMs);
  return {
    traceId: `trace-${index}`,
    name: `agent run: '${agent}'`,
    entityType: 'agent',
    status,
    inputPreview: 'Summarize the latest support tickets',
    createdAt: startedAt,
    startedAt,
    endedAt: status === 'running' ? null : new Date(startedAt.getTime() + durationMs),
  };
}

const traces = [
  trace(1, 'support-agent', 40_000, 2_820, 'success'),
  trace(2, 'docs-search', 3 * minute, 671, 'error'),
  trace(3, 'billing-bot', 12 * minute, 12_340, 'success'),
  trace(4, 'triage-agent', 55 * minute, 0, 'running'),
  trace(5, 'research-workflow', 26 * 60 * minute, 95_000, 'success'),
];

const meta: Meta<typeof TracesListView> = {
  title: 'Domains/Traces/TracesListView',
  component: TracesListView,
  parameters: { layout: 'padded' },
  args: { traces, onTraceClick: fn() },
};

export default meta;
type Story = StoryObj<typeof TracesListView>;

export const Default: Story = {
  render: args => (
    <div className="h-80">
      <TracesListView {...args} />
    </div>
  ),
};
