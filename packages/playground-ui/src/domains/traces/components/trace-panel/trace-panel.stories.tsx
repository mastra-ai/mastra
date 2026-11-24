import { SpanType } from '@mastra/core/observability';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { LightSpanRecord } from '../../types';
import { TracePanel } from './index';
import type { TracePanelFrameProps, TraceSpanView } from './index';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
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
): LightSpanRecord => ({
  ...rootSpan,
  spanId,
  parentSpanId,
  name,
  spanType,
  startedAt: at(start),
  endedAt: at(end),
});

function traceSpans(root: LightSpanRecord): LightSpanRecord[] {
  return [
    root,
    childSpan('gen-1', 'root', 'llm: gpt-4o-mini', SpanType.MODEL_GENERATION, 20, 1400),
    childSpan('tool-1', 'gen-1', "tool: 'get-weather'", SpanType.TOOL_CALL, 400, 1100),
    childSpan('gen-2', 'root', 'llm: gpt-4o-mini', SpanType.MODEL_GENERATION, 1420, 2320),
  ];
}

const usage = { inputTokens: 12_400, outputTokens: 860, estimatedCost: 0.0042, costUnit: 'usd' };

interface StoryPanelProps {
  spans: LightSpanRecord[];
  variant?: TracePanelFrameProps['variant'];
  spanView?: TraceSpanView;
  streamed?: boolean;
}

/**
 * Every part of the panel, each in its slot. The data comes from the story, as it would from any host:
 * nothing inside the panel fetches.
 */
function FullComposition({ spans, variant, spanView, streamed }: StoryPanelProps) {
  const [traceId, setTraceId] = useState<string | undefined>(rootSpan.traceId);
  return (
    <TracePanel
      traceId={traceId}
      spans={spans}
      spanView={spanView}
      onClose={() => setTraceId(undefined)}
      // The story's own navigation: any host opens things through callbacks, here a no-op.
      navigation={{ onOpenAgent: () => {}, onOpenWorkflow: () => {}, onOpenTrace: () => {}, onOpenTool: () => {} }}
    >
      <TracePanel.Frame
        variant={variant}
        header={
          <TracePanel.Header
            navigation={<TracePanel.Navigation onPrevious={() => {}} onNext={() => {}} />}
            title={<TracePanel.TraceId />}
            actions={
              <>
                <TracePanel.ScoreButton />
                <TracePanel.DatasetButton onSaveAsDatasetItem={() => {}} />
                <TracePanel.OpenPageButton />
                <TracePanel.DownloadButton onDownload={() => {}} />
                {variant !== 'inline' && <TracePanel.CloseButton />}
              </>
            }
          />
        }
        summary={
          <TracePanel.Summary
            entity={<TracePanel.Entity />}
            status={<TracePanel.Status />}
            stats={<TracePanel.Stats usage={usage} />}
          />
        }
        body={
          <TracePanel.Body
            side={
              <TracePanel.Side
                feedback={<p className="text-label text-muted-foreground">The host renders its feedback here.</p>}
                feedbackCount={2}
                scores={<p className="text-label text-muted-foreground">The host renders its scores here.</p>}
              />
            }
            main={
              <TracePanel.Main
                toolbar={
                  <TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />
                }
                notices={<TracePanel.RootError />}
                spans={
                  <TracePanel.Spans
                    streamingTimings={streamed ? { timeToFirstChunkMs: 1830, timeToFirstTokenMs: 210 } : undefined}
                  />
                }
              />
            }
            span={<TracePanel.SpanDetail span={undefined} />}
          />
        }
        dialogs={<TracePanel.ScoreDialog scorers={{}} onTriggerScorer={async () => {}} />}
      />
    </TracePanel>
  );
}

const meta = {
  title: 'Domains/Traces/TracePanel',
  component: FullComposition,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    spans: traceSpans(rootSpan),
  },
} satisfies Meta<typeof FullComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {};

export const Inline: Story = {
  args: { variant: 'inline' },
  render: args => (
    <div className="h-screen">
      <FullComposition {...args} />
    </div>
  ),
};

export const Running: Story = {
  args: { spans: traceSpans({ ...rootSpan, endedAt: null }) },
};

export const Failed: Story = {
  args: { spans: traceSpans({ ...rootSpan, error: { message: 'Weather API returned 503' } }) },
};

/** The second generation's inference started at 1.62s and sent its first chunk at 1.83s. */
export const StreamedOnTimeline: Story = {
  args: { spanView: 'timeline', streamed: true },
};

/** Only the slots a host fills render: here, no side column, no summary and a trimmed header. */
export const Minimal: Story = {
  render: args => (
    <TracePanel traceId={rootSpan.traceId} spans={args.spans} onClose={() => {}}>
      <TracePanel.Frame
        header={<TracePanel.Header title={<TracePanel.TraceId />} actions={<TracePanel.CloseButton />} />}
        body={<TracePanel.Body main={<TracePanel.Main spans={<TracePanel.Spans />} />} />}
      />
    </TracePanel>
  ),
};

/** A host drops its own elements in the slots, next to the parts or instead of them. */
export const HostElements: Story = {
  render: args => (
    <TracePanel traceId={rootSpan.traceId} spans={args.spans} onClose={() => {}}>
      <TracePanel.Frame
        banner={
          <Notice variant="info">
            <Notice.Message>Opened from a feedback review.</Notice.Message>
          </Notice>
        }
        header={
          <TracePanel.Header
            title={<TracePanel.TraceId />}
            actions={
              <>
                <Button size="sm" variant="ghost">
                  Share
                </Button>
                <TracePanel.CloseButton />
              </>
            }
          />
        }
        body={
          <TracePanel.Body
            side={<div className="p-4 text-label text-muted-foreground">A side column of the host's own.</div>}
            main={
              <TracePanel.Main
                toolbar={<TracePanel.SpansToolbar search={<TracePanel.Search />} />}
                spans={<TracePanel.Spans renderRowTrailing={() => <span className="text-muted-foreground">●</span>} />}
              />
            }
          />
        }
      />
    </TracePanel>
  ),
};
