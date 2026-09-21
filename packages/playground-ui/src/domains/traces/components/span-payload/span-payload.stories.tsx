import { describeSpanInput, describeSpanOutput } from '@mastra/core/observability';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileInputIcon, FileOutputIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SpanDataPanelView } from '../span-data-panel-view';
import { SpanDetailsView } from '../span-details-view';
import { ALL_SPAN_FIXTURES } from './__tests__/fixtures/span-payloads';
import type { SpanRecord } from './__tests__/fixtures/span-payloads';
import { SpanErrorRenderer } from './span-error-renderer';
import { SpanInputRenderer } from './span-input-renderers';
import { SpanOutputRenderer } from './span-output-renderers';
import { asCoreSpan } from './span-payload-registry';
import { SpanPayloadSection } from './span-payload-section';

type FixtureName = keyof typeof ALL_SPAN_FIXTURES;
const FIXTURE_NAMES = Object.keys(ALL_SPAN_FIXTURES) as FixtureName[];

const meta: Meta = {
  title: 'Domains/Traces/SpanPayload',
  parameters: { layout: 'padded' },
};

export default meta;

function Cell({ title, tag, children }: { title: string; tag: string | undefined; children: ReactNode }) {
  return (
    <div className="border-border flex min-w-0 flex-col gap-2 rounded-lg border p-3">
      <div className="text-meta text-placeholder flex items-center justify-between tracking-widest uppercase">
        <span>{title}</span>
        <code className="text-muted-foreground font-mono normal-case">{tag ?? 'undefined'}</code>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{children}</div>;
}

export const InputRenderers: StoryObj = {
  render: () => (
    <Grid>
      {FIXTURE_NAMES.map(name => {
        const span = ALL_SPAN_FIXTURES[name];
        return (
          <Cell key={name} title={name} tag={describeSpanInput(asCoreSpan(span))?.type}>
            <SpanPayloadSection
              title="Input"
              icon={<FileInputIcon />}
              raw={span.input}
              hasPreview={describeSpanInput(asCoreSpan(span))?.type !== 'json'}
            >
              <SpanInputRenderer span={span} />
            </SpanPayloadSection>
          </Cell>
        );
      })}
    </Grid>
  ),
};

export const OutputRenderers: StoryObj = {
  render: () => (
    <Grid>
      {FIXTURE_NAMES.map(name => {
        const span = ALL_SPAN_FIXTURES[name];
        return (
          <Cell key={name} title={name} tag={describeSpanOutput(asCoreSpan(span))?.type}>
            <SpanPayloadSection
              title="Output"
              icon={<FileOutputIcon />}
              raw={span.output}
              hasPreview={describeSpanOutput(asCoreSpan(span))?.type !== 'json'}
            >
              <SpanOutputRenderer span={span} />
            </SpanPayloadSection>
          </Cell>
        );
      })}
    </Grid>
  ),
};

export const ErrorRenderer: StoryObj = {
  render: () => (
    <Grid>
      <Cell title="errorSpan" tag="error">
        <SpanPayloadSection title="Error" raw={ALL_SPAN_FIXTURES.errorSpan.error}>
          <SpanErrorRenderer span={ALL_SPAN_FIXTURES.errorSpan} />
        </SpanPayloadSection>
      </Cell>
      <Cell title="toolCallSpan (no error)" tag={undefined}>
        <SpanErrorRenderer span={ALL_SPAN_FIXTURES.toolCallSpan} />
      </Cell>
    </Grid>
  ),
};

function Both({ span }: { span: SpanRecord }) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <SpanPayloadSection
        title="Input"
        icon={<FileInputIcon />}
        raw={span.input}
        hasPreview={describeSpanInput(asCoreSpan(span))?.type !== 'json'}
      >
        <SpanInputRenderer span={span} />
      </SpanPayloadSection>
      <SpanPayloadSection
        title="Output"
        icon={<FileOutputIcon />}
        raw={span.output}
        hasPreview={describeSpanOutput(asCoreSpan(span))?.type !== 'json'}
      >
        <SpanOutputRenderer span={span} />
      </SpanPayloadSection>
      <SpanPayloadSection title="Error" raw={span.error}>
        <SpanErrorRenderer span={span} />
      </SpanPayloadSection>
    </div>
  );
}

export const Messages: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.agentRunMessagesSpan} /> };
export const LongSystemPrompt: StoryObj = {
  render: () => (
    <Both
      span={{
        ...ALL_SPAN_FIXTURES.agentRunMessagesSpan,
        input: [
          {
            role: 'system',
            content: `    You are Michel, a practical and experienced home chef.\n${'    Explain cooking steps clearly and offer substitutions using the ingredients available.\n'.repeat(10)}`,
          },
          { role: 'user', content: 'What can I cook with tomatoes and rice?' },
        ],
      }}
    />
  ),
};
export const MessagesShallow: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.modelStepSpan} /> };
export const AgentRunResume: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.agentRunResumeSpan} /> };
export const Interrupted: StoryObj = {
  render: () => (
    <Grid>
      <Both span={ALL_SPAN_FIXTURES.agentRunSuspendedSpan} />
      <Both span={ALL_SPAN_FIXTURES.agentRunAbortedSpan} />
    </Grid>
  ),
};
export const ModelGenerationResult: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.modelGenerationSpan} /> };
export const Tripwire: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.agentRunTripwireSpan} /> };
export const JsonFallback: StoryObj = {
  render: () => (
    <Grid>
      <Both span={ALL_SPAN_FIXTURES.toolCallSpan} />
      <Both span={ALL_SPAN_FIXTURES.workflowStepSpan} />
    </Grid>
  ),
};
export const LongText: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.longTextSpan} /> };
export const UnknownMessagePart: StoryObj = { render: () => <Both span={ALL_SPAN_FIXTURES.unknownPartSpan} /> };

type FixtureArgs = { fixture: FixtureName };

export const FullSpanPanel: StoryObj<FixtureArgs> = {
  args: { fixture: 'agentRunMessagesSpan' },
  argTypes: { fixture: { control: 'select', options: FIXTURE_NAMES } },
  render: ({ fixture }) => {
    const span = ALL_SPAN_FIXTURES[fixture];
    return (
      <div className="h-[80vh] max-w-3xl">
        <SpanDataPanelView traceId={span.traceId} spanId={span.spanId} span={span} />
      </div>
    );
  },
};

export const CompactSpanDetails: StoryObj<FixtureArgs> = {
  args: { fixture: 'agentRunMessagesSpan' },
  argTypes: { fixture: { control: 'select', options: FIXTURE_NAMES } },
  render: ({ fixture }) => {
    const span = ALL_SPAN_FIXTURES[fixture];
    return (
      <div className="h-[80vh] max-w-xl">
        <SpanDetailsView spanId={span.spanId} span={span} onClose={() => {}} />
      </div>
    );
  },
};
