import { describeProcessorPipeline, describeSpanInput, describeSpanOutput } from '@mastra/core/observability';
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
import { SpanProcessorAttributes } from './span-processor-attributes';

type FixtureName = keyof typeof ALL_SPAN_FIXTURES;
const FIXTURE_NAMES = Object.keys(ALL_SPAN_FIXTURES) as FixtureName[];

const meta: Meta = {
  title: 'Domains/Traces/SpanPayload',
  parameters: { layout: 'padded' },
};

export default meta;

function Cell({ title, tag, children }: { title: string; tag: string | undefined; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between text-meta tracking-widest text-placeholder uppercase">
        <span>{title}</span>
        <code className="font-mono text-muted-foreground normal-case">{tag ?? 'undefined'}</code>
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

const PROCESSOR_FIXTURES = [
  'processorInputSpan',
  'processorSystemMutationSpan',
  'processorClearedMessagesSpan',
  'malformedProcessorSpan',
  'processorTripwireSpan',
  'processorToolResultSpan',
  'processorOutputStreamSpan',
  'processorInputStepSpan',
  'processorRequestErrorSpan',
  'legacyProcessorSpan',
] as const satisfies readonly FixtureName[];

/** Widths the span panel is read at: a phone drawer, a tablet split, a desktop panel. */
const PANEL_WIDTHS = [
  { label: 'Mobile', className: 'w-[360px]' },
  { label: 'Tablet', className: 'w-[640px]' },
  { label: 'Desktop', className: 'w-[960px]' },
];

export const ProcessorSpans: StoryObj = {
  render: () => (
    <Grid>
      {PROCESSOR_FIXTURES.map(name => (
        <Cell key={name} title={name} tag={describeSpanInput(asCoreSpan(ALL_SPAN_FIXTURES[name]))?.type}>
          <Both span={ALL_SPAN_FIXTURES[name]} />
        </Cell>
      ))}
    </Grid>
  ),
};

export const ProcessorKnownAttributes: StoryObj = {
  render: () => (
    <Grid>
      {PROCESSOR_FIXTURES.map(name => {
        const span = ALL_SPAN_FIXTURES[name];
        const hasPreview = describeProcessorPipeline(asCoreSpan(span)) !== undefined;
        return (
          <Cell key={name} title={name} tag={hasPreview ? 'processor' : 'json'}>
            <SpanPayloadSection title="Attributes" raw={span.attributes} hasPreview={hasPreview}>
              <SpanProcessorAttributes span={span} />
            </SpanPayloadSection>
          </Cell>
        );
      })}
    </Grid>
  ),
};

export const ProcessorSpanAtPanelWidths: StoryObj<FixtureArgs> = {
  args: { fixture: 'processorInputSpan' },
  argTypes: { fixture: { control: 'select', options: PROCESSOR_FIXTURES } },
  render: ({ fixture }) => {
    const span = ALL_SPAN_FIXTURES[fixture];
    return (
      <div className="flex flex-wrap items-start gap-4">
        {PANEL_WIDTHS.map(width => (
          <div key={width.label} className={`flex h-[80vh] flex-col gap-2 ${width.className}`}>
            <div className="text-meta tracking-widest text-placeholder uppercase">{width.label}</div>
            <SpanDataPanelView traceId={span.traceId} spanId={span.spanId} span={span} />
          </div>
        ))}
      </div>
    );
  },
};
