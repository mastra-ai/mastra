import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
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
    // slight hacks until otel-exporter adheres to modern genai spec
    if (span.attributes['input']) {
      span.attributes['gen_ai.input.messages'] = span.attributes['input'];
    }
    if (span.attributes['agent.id']) {
      span.attributes['gen_ai.agent.id'] = span.attributes['agent.id'];
    }
    const attributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(span.attributes);
    return {
      ...span,
      attributes,
    };
  }
}
