import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import { SemanticConventions } from '@arizeai/openinference-semantic-conventions';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { convertMastraMessagesToGenAIMessages } from './gen-ai';

export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      const attributes = { ...(span.attributes ?? {}) };
      const mutableSpan = span as Mutable<ReadableSpan>;

      if (attributes['gen_ai.prompt'] && typeof attributes['gen_ai.prompt'] === 'string') {
        attributes['gen_ai.input.messages'] = convertMastraMessagesToGenAIMessages(attributes['gen_ai.prompt']);
      }

      if (attributes['gen_ai.completion'] && typeof attributes['gen_ai.completion'] === 'string') {
        attributes['gen_ai.output.messages'] = convertMastraMessagesToGenAIMessages(attributes['gen_ai.completion']);
      }

      const sessionId = typeof attributes['threadId'] === 'string' ? (attributes['threadId'] as string) : undefined;
      const userId = typeof attributes['userId'] === 'string' ? (attributes['userId'] as string) : undefined;

      if (sessionId) {
        attributes[SemanticConventions.SESSION_ID] = sessionId;
        delete attributes['threadId'];
      }

      if (userId) {
        attributes[SemanticConventions.USER_ID] = userId;
        delete attributes['userId'];
      }

      const processedAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(attributes);

      if (processedAttributes) {
        if (sessionId) {
          processedAttributes[SemanticConventions.SESSION_ID] = sessionId;
        }
        if (userId) {
          processedAttributes[SemanticConventions.USER_ID] = userId;
        }
        mutableSpan.attributes = processedAttributes;
      }

      return mutableSpan;
    });

    super.export(processedSpans, resultCallback);
  }
}
