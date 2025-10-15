import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import { ReadableSpanConverterInterface } from '@mastra/otel-exporter';
import type { Resource } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

export class ArizeSpanConverter extends ReadableSpanConverterInterface {
  constructor(resource?: Resource) {
    super();
    this.init(resource);
  }

  init(resource?: Resource): void {
    this.resource = resource;
  }

  convertSpan(span: ReadableSpan): ReadableSpan {
    if (span.attributes['agent.id']) {
      span.attributes['gen_ai.agent.id'] = span.attributes['agent.id'];
    }
    const attributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(span.attributes);
    (span as Mutable<ReadableSpan>).attributes = attributes;
    return span;
  }
}
