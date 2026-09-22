import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { UISpan } from '../types';
import { TraceSpanTimeline } from './trace-span-timeline';
import { TraceSpanTree } from './trace-span-tree';

const base = new Date('2026-06-01T10:00:00.000Z').getTime();
const at = (ms: number) => new Date(base + ms).toISOString();

// Each span gets a real window so the timeline bars are nested inside their parent.
function span(id: string, name: string, type: string, start: number, end: number, spans?: UISpan[]): UISpan {
  return { id, name, type, latency: end - start, startTime: at(start), endTime: at(end), spans };
}

const hierarchicalSpans: UISpan[] = [
  span('root', 'agent run', 'agent_run', 0, 1200, [
    span('gen-1', 'llm generation', 'model_generation', 10, 500, [
      span('tool-1', 'weather tool', 'tool_call', 20, 300, [span('http-1', 'http fetch', 'tool_call', 30, 250)]),
      span('mem-1', 'memory lookup', 'memory_operation', 320, 480),
    ]),
    span('wf-1', 'workflow run', 'workflow_run', 520, 1150, [
      span('step-1', 'step normalize', 'workflow_step', 530, 700),
      span('gen-2', 'llm generation', 'model_generation', 720, 1140),
    ]),
  ]),
];

function Views({ view }: { view: 'tree' | 'timeline' | 'both' }) {
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>(['root', 'gen-1', 'wf-1']);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>('tool-1');
  const shared = {
    hierarchicalSpans,
    expandedSpanIds,
    setExpandedSpanIds,
    selectedSpanId,
    onSpanClick: (id: string) => setSelectedSpanId(prev => (prev === id ? undefined : id)),
  };

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: view === 'both' ? '1fr 1fr' : '1fr' }}>
      {view !== 'timeline' && (
        <div className="bg-card rounded-md p-2">
          <TraceSpanTree {...shared} />
        </div>
      )}
      {view !== 'tree' && (
        <div className="bg-card rounded-md p-2">
          <TraceSpanTimeline {...shared} />
        </div>
      )}
    </div>
  );
}

const meta = {
  title: 'Domains/Traces/TraceSpanViews',
  component: Views,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Views>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tree: Story = { args: { view: 'tree' } };
export const Timeline: Story = { args: { view: 'timeline' } };
/** Both views share expansion and selection state, so rows stay aligned. */
export const SideBySide: Story = { args: { view: 'both' } };
