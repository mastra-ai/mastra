import type {
  ProcessorRunInputByPhase,
  ProcessorRunOutputByPhase,
  ProcessorSpanPayload,
} from '@mastra/core/observability';
import { Fragment } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { SpanPayloadMessages } from './span-payload-messages';
import {
  SpanPayloadCollapsible,
  SpanPayloadField,
  SpanPayloadMarkdown,
  SpanPayloadToolCalls,
} from './span-payload-primitives';
import { isScalar, processorInputToolKeys, readProcessorPayload } from './span-payload-processor-fields';
import type { Scalar } from './span-payload-processor-fields';
import { hasItems } from './span-payload-registry';
import { SpanToolNameValue } from './span-payload-tool';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';

const formatScalar = (value: Scalar): string => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value));

const withCount = (label: string, value: unknown) => (Array.isArray(value) ? `${label} (${value.length})` : label);

export interface SpanPayloadProcessorProps {
  value: ProcessorSpanPayload<ProcessorRunInputByPhase> | ProcessorSpanPayload<ProcessorRunOutputByPhase>;
  /** Keys another section already shows; left out of the preview but kept in the raw JSON. */
  hidden?: readonly string[];
}

/**
 * A processor span's input or output. One renderer serves every phase: the
 * phases share most keys, and each payload carries only the ones its phase
 * records. The phase itself is shown once, in the Attributes preview.
 */
export function SpanPayloadProcessor({ value, hidden = [] }: SpanPayloadProcessorProps) {
  const { data, messages, toolCalls, texts, error, scalars, context, extras, formatsAny } = readProcessorPayload(
    value.data,
    hidden,
  );
  const hasExtras = Object.keys(extras).length > 0;

  // With nothing placed, an "Other fields" disclosure would only wrap the whole payload: show it as JSON.
  if (!formatsAny) {
    return (
      <div data-slot="span-payload-processor" data-phase={value.phase}>
        <SpanPayloadJson value={data} />
      </div>
    );
  }

  return (
    <div data-slot="span-payload-processor" data-phase={value.phase} className="flex flex-col gap-3">
      {messages.length > 0 && <SpanPayloadMessages value={messages} />}
      {toolCalls.length > 0 && (
        <SpanPayloadField label={`Tool calls (${toolCalls.length})`}>
          <SpanPayloadToolCalls toolCalls={toolCalls} />
        </SpanPayloadField>
      )}
      {texts.map((text, index) => (
        <SpanPayloadMarkdown key={index}>{text}</SpanPayloadMarkdown>
      ))}
      {error !== undefined && (
        <SpanPayloadField label="Error">
          <SpanPayloadMarkdown>{error}</SpanPayloadMarkdown>
        </SpanPayloadField>
      )}
      {scalars.length > 0 && (
        <DataKeysAndValues>
          {scalars.map(field => {
            const scalar = data[field.key];
            if (!isScalar(scalar)) return null;
            return (
              <Fragment key={field.key}>
                <DataKeysAndValues.Key>{field.label}</DataKeysAndValues.Key>
                {field.key === 'toolName' ? (
                  <SpanToolNameValue toolName={String(scalar)} />
                ) : 'copy' in field ? (
                  <DataKeysAndValues.ValueWithCopyBtn copyValue={String(scalar)}>
                    {formatScalar(scalar)}
                  </DataKeysAndValues.ValueWithCopyBtn>
                ) : (
                  <DataKeysAndValues.Value>{formatScalar(scalar)}</DataKeysAndValues.Value>
                )}
              </Fragment>
            );
          })}
        </DataKeysAndValues>
      )}
      {context.map(({ key, label }) => (
        <SpanPayloadCollapsible key={key} label={withCount(label, data[key])}>
          <SpanPayloadJson value={data[key]} />
        </SpanPayloadCollapsible>
      ))}
      {hasExtras && (
        <SpanPayloadCollapsible label="Other fields">
          <SpanPayloadJson value={extras} />
        </SpanPayloadCollapsible>
      )}
    </div>
  );
}

/** A processor span's input, without the tools and tool choice the Tools section shows. */
export function SpanPayloadProcessorInput({ value }: { value: ProcessorSpanPayload<ProcessorRunInputByPhase> }) {
  return <SpanPayloadProcessor value={value} hidden={processorInputToolKeys(value.data)} />;
}
