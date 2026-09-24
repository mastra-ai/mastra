import { SpanType } from '@mastra/core/observability';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LightSpanRecord } from '../types';
import { toSearchableSpans } from '../utils';
import { TraceDataPanelView } from './trace-data-panel-view';
import { TooltipProvider } from '@/ds/components/Tooltip';

const traceStart = new Date('2026-06-01T10:00:00.000Z').getTime();
const at = (ms: number) => new Date(traceStart + ms).toISOString();

const rootSpan: LightSpanRecord = {
  traceId: 'a3f9c2e1b7d04e5f',
  spanId: 'root',
  parentSpanId: null,
  name: "agent run: 'weather-agent'",
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  entityType: 'agent',
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  startedAt: at(0),
  endedAt: at(2340),
  createdAt: at(0),
  updatedAt: at(2340),
};

const childSpan = (
  spanId: string,
  parentSpanId: string,
  name: string,
  spanType: SpanType,
  start: number,
  end: number,
) => ({
  ...rootSpan,
  spanId,
  parentSpanId,
  name,
  spanType,
  startedAt: at(start),
  endedAt: at(end),
});

function traceSpans(root: LightSpanRecord) {
  return toSearchableSpans([
    root,
    childSpan('gen-1', 'root', 'llm: gpt-4o-mini', SpanType.MODEL_GENERATION, 20, 1400),
    childSpan('tool-1', 'gen-1', "tool: 'get-weather'", SpanType.TOOL_CALL, 400, 1100),
    childSpan('gen-2', 'root', 'llm: gpt-4o-mini', SpanType.MODEL_GENERATION, 1420, 2320),
  ]);
}

const usage = { inputTokens: 12_400, outputTokens: 860, estimatedCost: 0.0042, costUnit: 'usd' };

const queryClient = new QueryClient();

const meta = {
  title: 'Domains/Traces/TraceDataPanelView',
  component: TraceDataPanelView,
  decorators: [
    Story => (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    traceId: rootSpan.traceId,
    spans: traceSpans(rootSpan),
    usage,
    onClose: () => {},
  },
} satisfies Meta<typeof TraceDataPanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

const studioSidePanelArgs = {
  placement: 'traces-list',
  entityHref: '#',
  onEvaluateTrace: () => {},
  onSaveAsDatasetItem: () => {},
  onAddTraceMocksToItem: () => {},
  onPrevious: () => {},
  onNext: () => {},
} satisfies Partial<Story['args']>;

export const SidePanel: Story = {
  args: studioSidePanelArgs,
};

export const TracePage: Story = {
  args: {
    placement: 'trace-page',
    size: 'wide',
    usage: undefined,
  },
};

export const Running: Story = {
  args: {
    ...studioSidePanelArgs,
    spans: traceSpans({ ...rootSpan, endedAt: null }),
    usage: undefined,
  },
};

export const Failed: Story = {
  args: {
    ...studioSidePanelArgs,
    spans: traceSpans({ ...rootSpan, error: { message: 'Weather API returned 503' } }),
  },
};
