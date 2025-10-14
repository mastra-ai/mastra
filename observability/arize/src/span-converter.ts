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
    const attributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(span.attributes);
    return {
      ...span,
      attributes,
    };
  }
}
