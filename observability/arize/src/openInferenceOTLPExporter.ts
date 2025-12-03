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

      // Gather custom attributes into OpenInference metadata (flat best-effort)
      const reservedPrefixes = [
        'gen_ai.',
        'llm.',
        'input.',
        'output.',
        'span.',
        'mastra',
        'agent.',
        'workflow.',
        'mcp.',
        'openinference.',
        'retrieval.',
        'reranker.',
        'embedding.',
        'document.',
        'tool',
        'error.',
        'http.',
        'db.',
      ];
      const metadataEntries: Record<string, unknown> = {};
      const reservedExact = new Set<string>(['input', 'output', 'sessionId', 'metadata']);
      for (const [key, value] of Object.entries(attributes)) {
        const isReserved =
          reservedPrefixes.some(prefix => key.startsWith(prefix)) ||
          key === 'threadId' ||
          key === 'userId' ||
          key === SemanticConventions.SESSION_ID ||
          key === SemanticConventions.USER_ID ||
          reservedExact.has(key);
        if (!isReserved) {
          metadataEntries[key] = value;
        }
      }

      let metadataPayload: string | undefined;
      if (Object.keys(metadataEntries).length > 0) {
        try {
          metadataPayload = JSON.stringify(metadataEntries);
          attributes[SemanticConventions.METADATA] = metadataPayload;
        } catch {
          // best-effort only
        }
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
        if (metadataPayload) {
          processedAttributes[SemanticConventions.METADATA] = metadataPayload;
        }
        // Map mastra.tags to OpenInference native tag.tags convention (tags are only on root spans)
        if (attributes['mastra.tags']) {
          processedAttributes[SemanticConventions.TAG_TAGS] = attributes['mastra.tags'];
        }
        mutableSpan.attributes = processedAttributes;
      }

      return mutableSpan;
    });

    super.export(processedSpans, resultCallback);
  }
}
