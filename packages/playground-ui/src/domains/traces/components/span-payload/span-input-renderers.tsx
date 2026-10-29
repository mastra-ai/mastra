import { describeSpanInput } from '@mastra/core/observability';
import type { AgentRunResumeInput, SpanInputDescription } from '@mastra/core/observability';
import type { SpanRecord } from '../../types';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages, SpanSignal } from './span-payload-messages';
import { SpanPayloadField, SpanPayloadMarkdown } from './span-payload-primitives';
import { SpanPayloadProcessorInput } from './span-payload-processor';
import { asCoreSpan, pickRenderer } from './span-payload-registry';
import type { PayloadRegistry } from './span-payload-registry';
import { SpanToolNameValue } from './span-payload-tool';
import { getSpanSignal } from '@/domains/traces/utils/span-signal';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

function SpanTextRenderer({ value }: { value: string }) {
  return <SpanPayloadMarkdown>{value}</SpanPayloadMarkdown>;
}

function SpanAgentRunResumeRenderer({ value }: { value: AgentRunResumeInput }) {
  const { resumeData, toolName, toolCallId, ...rest } = value;
  const hasTarget = toolName !== undefined || toolCallId !== undefined;
  const data = resumeData !== undefined ? resumeData : Object.keys(rest).length > 0 ? rest : undefined;
  return (
    <div data-slot="span-agent-run-resume" className="flex flex-col gap-6">
      {hasTarget && (
        <SpanPayloadField label="Resumes into">
          <DataKeysAndValues>
            {toolName !== undefined && (
              <>
                <DataKeysAndValues.Key>Tool</DataKeysAndValues.Key>
                <SpanToolNameValue toolName={String(toolName)} />
              </>
            )}
            {toolCallId !== undefined && (
              <>
                <DataKeysAndValues.Key>Tool call id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn copyValue={String(toolCallId)}>
                  {String(toolCallId)}
                </DataKeysAndValues.ValueWithCopyBtn>
              </>
            )}
          </DataKeysAndValues>
        </SpanPayloadField>
      )}
      {data !== undefined && (
        <SpanPayloadField label="Resume data">
          <SpanPayloadJson value={data} />
        </SpanPayloadField>
      )}
    </div>
  );
}

/**
 * One renderer per `describeSpanInput` tag. `satisfies` keeps the map exhaustive: a
 * new tag in core is a type error here until it gets a renderer (or maps to JSON).
 */
const SPAN_INPUT_RENDERERS = {
  text: SpanTextRenderer,
  messages: SpanPayloadMessages,
  'agent-run-resume': SpanAgentRunResumeRenderer,
  processor: SpanPayloadProcessorInput,
  json: SpanPayloadJson,
} satisfies PayloadRegistry<SpanInputDescription>;

export interface SpanInputRendererProps {
  span: SpanRecord;
}

/**
 * Renders a span's input through the registry; `null` when the span recorded none. An agent
 * run started by a signal renders the signal, which `describeSpanInput` only knows as JSON.
 */
export function SpanInputRenderer({ span }: SpanInputRendererProps) {
  const signal = getSpanSignal(span);
  if (signal) return <SpanSignal signal={signal} />;
  const description = describeSpanInput(asCoreSpan(span));
  if (!description) return null;
  if (description.type === 'json') return <SpanPayloadJson value={description.value} />;
  const Renderer = pickRenderer(SPAN_INPUT_RENDERERS, description);
  return <Renderer value={description.value} />;
}
