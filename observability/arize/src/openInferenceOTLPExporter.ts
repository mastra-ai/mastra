import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import {
  INPUT_MIME_TYPE,
  INPUT_VALUE,
  METADATA,
  OUTPUT_MIME_TYPE,
  OUTPUT_VALUE,
  SESSION_ID,
  TAG_TAGS,
  USER_ID,
} from '@arizeai/openinference-semantic-conventions';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
} from '@opentelemetry/semantic-conventions/incubating';

const RESERVED_PREFIXES = [
  'gen_ai.',
  'llm.',
  'input.',
  'output.',
  'span.',
  'mastra.',
  'agent.',
  'workflow.',
  'mcp.',
  'openinference.',
  'retrieval.',
  'reranker.',
  'embedding.',
  'document.',
  'tool.',
  'error.',
  'http.',
  'db.',
];

const RESERVED_EXACT = new Set<string>([
  'input',
  'output',
  'metadata',
  'sessionId',
  'threadId',
  'userId',
  SESSION_ID,
  USER_ID,
])

export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      const attributes = { ...(span.attributes ?? {}) };
      const mutableSpan = span as Mutable<ReadableSpan>;
      const metadataEntries: Record<string, unknown> = {};

      // Gather custom attributes into OpenInference metadata (flat best-effort)
      for (const [key, value] of Object.entries(attributes)) {
        const isReserved =
          RESERVED_EXACT.has(key) ||
          RESERVED_PREFIXES.some(prefix => key.startsWith(prefix))
        if (!isReserved) {
          metadataEntries[key] = value;
        }
      }

      let metadataPayload: string | undefined;
      if (Object.keys(metadataEntries).length > 0) {
        try {
          metadataPayload = JSON.stringify(metadataEntries);
          attributes[METADATA] = metadataPayload;
        } catch {
          // best-effort only
        }
      }

      const sessionId = typeof attributes['threadId'] === 'string' ? (attributes['threadId'] as string) : undefined;
      const userId = typeof attributes['userId'] === 'string' ? (attributes['userId'] as string) : undefined;

      if (sessionId) {
        attributes[SESSION_ID] = sessionId;
        delete attributes['threadId'];
      }

      if (userId) {
        attributes[USER_ID] = userId;
        delete attributes['userId'];
      }

      const processedAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(attributes);

      // only add processed attributes if conversion was successful
      if (processedAttributes) {
        if (sessionId) {
          processedAttributes[SESSION_ID] = sessionId;
        }
        if (userId) {
          processedAttributes[USER_ID] = userId;
        }
        if (metadataPayload) {
          processedAttributes[METADATA] = metadataPayload;
        }

        // Map mastra.tags to OpenInference native tag.tags convention (tags are only on root spans)
        if (attributes['mastra.tags']) {
          processedAttributes[TAG_TAGS] = attributes['mastra.tags'];
        }

        const inputMessages = span.attributes[ATTR_GEN_AI_INPUT_MESSAGES];
        if (inputMessages) {
          processedAttributes[INPUT_MIME_TYPE] = 'application/json';
          processedAttributes[INPUT_VALUE] = inputMessages;
        }
        const outputMessages = span.attributes[ATTR_GEN_AI_OUTPUT_MESSAGES];
        if (outputMessages) {
          processedAttributes[OUTPUT_MIME_TYPE] = 'application/json';
          processedAttributes[OUTPUT_VALUE] = outputMessages;
        }

        mutableSpan.attributes = processedAttributes;
      }

      return mutableSpan;
    });

    super.export(processedSpans, resultCallback);
  }
}
