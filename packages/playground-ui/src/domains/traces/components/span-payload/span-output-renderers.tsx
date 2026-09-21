import { describeSpanOutput } from '@mastra/core/observability';
import type {
  AgentRunResult,
  InterruptedSpanOutput,
  ModelGenerationResult,
  ModelStepResult,
  SpanOutputDescription,
} from '@mastra/core/observability';
import type { SpanRecord } from '../../types';
import { SpanPayloadAttachment } from './span-payload-attachment';
import { SpanPayloadJson } from './span-payload-json';
import {
  SpanPayloadCollapsible,
  SpanPayloadField,
  SpanPayloadMarkdown,
  SpanPayloadToolCalls,
} from './span-payload-primitives';
import { asCoreSpan, pickRenderer } from './span-payload-registry';
import type { PayloadRegistry } from './span-payload-registry';
import { Reasoning } from '@/domains/chat/messages/reasoning';
import { Card, CardContent } from '@/ds/components/Card';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { Notice } from '@/ds/components/Notice';

const hasItems = (value: unknown): value is unknown[] => Array.isArray(value) && value.length > 0;

function SpanTextRenderer({ value }: { value: string }) {
  return <SpanPayloadMarkdown>{value}</SpanPayloadMarkdown>;
}

function SpanInterruptedRenderer({ value }: { value: InterruptedSpanOutput }) {
  const title = value.status === 'suspended' ? 'Suspended' : 'Aborted';
  const hasTarget = value.toolName !== undefined || value.toolCallId !== undefined;
  return (
    <div data-slot="span-interrupted" data-status={value.status} className="flex flex-col gap-3">
      <Notice variant="warning" title={title}>
        {value.reason && <Notice.Message>{value.reason}</Notice.Message>}
      </Notice>
      {hasTarget && (
        <DataKeysAndValues>
          {value.toolName !== undefined && (
            <>
              <DataKeysAndValues.Key>Tool</DataKeysAndValues.Key>
              <DataKeysAndValues.Value>{value.toolName}</DataKeysAndValues.Value>
            </>
          )}
          {value.toolCallId !== undefined && (
            <>
              <DataKeysAndValues.Key>Tool call id</DataKeysAndValues.Key>
              <DataKeysAndValues.ValueWithCopyBtn copyValue={value.toolCallId}>
                {value.toolCallId}
              </DataKeysAndValues.ValueWithCopyBtn>
            </>
          )}
        </DataKeysAndValues>
      )}
    </div>
  );
}

function SpanAgentRunResultRenderer({ value }: { value: AgentRunResult }) {
  return (
    <div data-slot="span-agent-run-result" className="flex flex-col gap-3">
      {value.tripwire && (
        <Notice variant="destructive" title="Tripwire">
          {value.tripwire.reason && <Notice.Message>{value.tripwire.reason}</Notice.Message>}
          {value.tripwire.processorId && (
            <div className="text-caption">
              Processor <code className="font-mono">{value.tripwire.processorId}</code>
            </div>
          )}
        </Notice>
      )}
      {typeof value.text === 'string' && value.text.length > 0 && (
        <SpanPayloadMarkdown>{value.text}</SpanPayloadMarkdown>
      )}
      {value.object !== undefined && (
        <SpanPayloadField label="Object">
          <SpanPayloadJson value={value.object} />
        </SpanPayloadField>
      )}
      {hasItems(value.files) && (
        <SpanPayloadCollapsible label={`Files (${value.files.length})`}>
          {value.files.map((file, index) => (
            <SpanPayloadAttachment key={index} value={file} />
          ))}
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}

function SpanModelGenerationResultRenderer({ value }: { value: ModelGenerationResult }) {
  return (
    <div data-slot="span-model-generation-result" className="flex flex-col gap-3">
      {typeof value.text === 'string' && value.text.length > 0 && (
        <SpanPayloadMarkdown>{value.text}</SpanPayloadMarkdown>
      )}
      {typeof value.reasoningText === 'string' && <Reasoning text={value.reasoningText} />}
      {value.reasoning !== undefined && (
        <SpanPayloadCollapsible label="Reasoning details">
          <SpanPayloadJson value={value.reasoning} />
        </SpanPayloadCollapsible>
      )}
      {value.object !== undefined && (
        <SpanPayloadField label="Object">
          <SpanPayloadJson value={value.object} />
        </SpanPayloadField>
      )}
      {hasItems(value.toolCalls) && (
        <SpanPayloadField label={`Tool calls (${value.toolCalls.length})`}>
          <SpanPayloadToolCalls toolCalls={value.toolCalls} />
        </SpanPayloadField>
      )}
      {hasItems(value.sources) && (
        <SpanPayloadCollapsible label={`Sources (${value.sources.length})`}>
          <SpanPayloadJson value={value.sources} />
        </SpanPayloadCollapsible>
      )}
      {hasItems(value.files) && (
        <SpanPayloadCollapsible label={`Files (${value.files.length})`}>
          {value.files.map((file, index) => (
            <SpanPayloadAttachment key={index} value={file} />
          ))}
        </SpanPayloadCollapsible>
      )}
      {hasItems(value.warnings) && (
        <SpanPayloadCollapsible label={`Warnings (${value.warnings.length})`}>
          <SpanPayloadJson value={value.warnings} />
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}

function SpanModelStepResultRenderer({ value }: { value: ModelStepResult }) {
  return (
    <div data-slot="span-model-step-result" className="flex flex-col gap-3">
      {typeof value.text === 'string' && value.text.length > 0 && (
        <SpanPayloadMarkdown>{value.text}</SpanPayloadMarkdown>
      )}
      {hasItems(value.toolCalls) && (
        <SpanPayloadField label={`Tool calls (${value.toolCalls.length})`}>
          <SpanPayloadToolCalls toolCalls={value.toolCalls} />
        </SpanPayloadField>
      )}
      {value.object !== undefined && (
        <SpanPayloadField label="Object">
          <SpanPayloadJson value={value.object} />
        </SpanPayloadField>
      )}
      {hasItems(value.steps) && (
        <SpanPayloadCollapsible label={`Steps (${value.steps.length})`}>
          <SpanPayloadJson value={value.steps} />
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}

/** One renderer per `describeSpanOutput` tag; see `SPAN_INPUT_RENDERERS`. */
const SPAN_OUTPUT_RENDERERS = {
  interrupted: SpanInterruptedRenderer,
  'agent-run-result': SpanAgentRunResultRenderer,
  'model-generation-result': SpanModelGenerationResultRenderer,
  'model-step-result': SpanModelStepResultRenderer,
  text: SpanTextRenderer,
  json: SpanPayloadJson,
} satisfies PayloadRegistry<SpanOutputDescription>;

export interface SpanOutputRendererProps {
  span: SpanRecord;
}

/** Renders a span's output through the registry; `null` when the span recorded none. */
export function SpanOutputRenderer({ span }: SpanOutputRendererProps) {
  const description = describeSpanOutput(asCoreSpan(span));
  if (!description) return null;
  if (description.type === 'json') return <SpanPayloadJson value={description.value} />;
  const Renderer = pickRenderer(SPAN_OUTPUT_RENDERERS, description);
  return (
    <Card data-slot="span-output-card" className="min-w-0">
      <CardContent>
        <Renderer value={description.value} />
      </CardContent>
    </Card>
  );
}
