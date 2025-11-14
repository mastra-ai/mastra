import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { convertMastraMessagesToGenAIMessages } from './gen-ai';

export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      // convert Mastra input messages to GenAI messages if present
      if (span.attributes?.['gen_ai.prompt'] && typeof span.attributes['gen_ai.prompt'] === 'string') {
        span.attributes['gen_ai.input.messages'] = convertMastraMessagesToGenAIMessages(
          span.attributes['gen_ai.prompt'],
        );
      }
      // convert Mastra output messages to GenAI messages if present
      if (span.attributes?.['gen_ai.completion'] && typeof span.attributes['gen_ai.completion'] === 'string') {
        span.attributes['gen_ai.output.messages'] = convertMastraMessagesToGenAIMessages(
          span.attributes['gen_ai.completion'],
        );
      }
      const processedAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(span.attributes);
      // only add processed attributes if conversion was successful
      if (processedAttributes) {
        (span as Mutable<ReadableSpan>).attributes = processedAttributes;
      }
      return span;
    });

    super.export(processedSpans, resultCallback);
  }
}
