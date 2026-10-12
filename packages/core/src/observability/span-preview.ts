import type { SpanRecord } from '../storage/domains/observability/tracing';
import { describeSpanInput, describeSpanOutput } from './span-record';

/** Native span values. Strings are never interpreted as serialized JSON. */
export type SpanPreviewSource = Pick<SpanRecord, 'spanType'> &
  Partial<Pick<SpanRecord, 'input' | 'output' | 'attributes' | 'metadata'>>;

export interface SpanPreview {
  value: string | null;
  truncated: boolean;
}

function boundedPreview(text: string | undefined): SpanPreview {
  if (!text) return { value: null, truncated: false };
  let value = '';
  let count = 0;
  for (const character of text) {
    if (count++ === 256) return { value, truncated: true };
    value += character;
  }
  return { value, truncated: false };
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (typeof part === 'string') return part;
      return part?.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join(' ');
}

/** Format native input for storage without changing existing trace input previews. */
export function buildSpanInputPreview(span: SpanPreviewSource): SpanPreview {
  const description = describeSpanInput(span as SpanRecord);
  if (!description) return boundedPreview(undefined);
  if (description.type === 'text') return boundedPreview(description.value);
  if (description.type === 'messages') {
    return boundedPreview(
      description.value
        .map(message =>
          typeof message === 'object' && message !== null && 'role' in message && message.role === 'user'
            ? contentText('content' in message ? message.content : 'parts' in message ? message.parts : undefined)
            : '',
        )
        .filter(Boolean)
        .join(' | '),
    );
  }
  return boundedPreview(JSON.stringify(description.value));
}

/** Format native output for storage; absent output stays absent. */
export function buildSpanOutputPreview(span: SpanPreviewSource): SpanPreview {
  const description = describeSpanOutput(span as SpanRecord);
  if (!description) return boundedPreview(undefined);
  if (description.type === 'text') return boundedPreview(description.value);
  if (description.type === 'interrupted') return boundedPreview(description.value.status);
  if (
    description.type === 'agent-run-result' ||
    description.type === 'model-generation-result' ||
    description.type === 'model-step-result'
  ) {
    const text = description.value.text;
    if (typeof text === 'string' && text) return boundedPreview(text);
  }
  return boundedPreview(JSON.stringify(description.value));
}
