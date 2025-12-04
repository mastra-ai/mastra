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

const MASTRA_GENERAL_PREFIX = 'mastra.';
const MASTRA_METADATA_PREFIX = 'mastra.metadata.';

/**
 * Splits Mastra span attributes into two groups:
 * - `metadata`: keys starting with "mastra.metadata." (prefix removed)
 * - `other`: all remaining keys starting with "mastra."
 *
 * Any attributes not starting with "mastra." are ignored entirely.
 */
function splitMastraAttributes(attributes: Record<string, any>): {
  mastraMetadata: Record<string, any>;
  mastraOther: Record<string, any>;
} {
  return Object.entries(attributes).reduce(
    (acc, [key, value]) => {
      if (key.startsWith(MASTRA_GENERAL_PREFIX)) {
        if (key.startsWith(MASTRA_METADATA_PREFIX)) {
          const strippedKey = key.slice(MASTRA_METADATA_PREFIX.length);
          acc.mastraMetadata[strippedKey] = value;
        } else {
          acc.mastraOther[key] = value;
        }
      }
      return acc;
    },
    {
      mastraMetadata: {} as Record<string, any>,
      mastraOther: {} as Record<string, any>,
    },
  );
}

export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      const attributes = { ...(span.attributes ?? {}) };
      const mutableSpan = span as Mutable<ReadableSpan>;

      const { mastraMetadata, mastraOther } = splitMastraAttributes(attributes);
      const processedAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(attributes);

      // only add processed attributes if conversion was successful
      if (processedAttributes) {
        const threadId = mastraMetadata['threadId'];
        if (threadId) {
          delete mastraMetadata['threadId'];
          processedAttributes[SESSION_ID] = threadId;
        }

        // Map mastra.tags to OpenInference native tag.tags convention (tags are only on root spans)
        if (mastraOther['mastra.tags']) {
          processedAttributes[TAG_TAGS] = mastraOther['mastra.tags'];
          delete mastraOther['mastra.tags'];
        }

        const userId = mastraMetadata['userId'];
        if (userId) {
          delete mastraMetadata['userId'];
          processedAttributes[USER_ID] = userId;
        }

        // Gather custom metadata into OpenInference metadata (flat best-effort)
        if (Object.keys(mastraMetadata).length > 0) {
          try {
            processedAttributes[METADATA] = JSON.stringify(mastraMetadata);
          } catch {
            // best-effort only
          }
        }

        const inputMessages = attributes[ATTR_GEN_AI_INPUT_MESSAGES];
        if (inputMessages) {
          processedAttributes[INPUT_MIME_TYPE] = 'application/json';
          processedAttributes[INPUT_VALUE] = inputMessages;
        }
        const outputMessages = attributes[ATTR_GEN_AI_OUTPUT_MESSAGES];
        if (outputMessages) {
          processedAttributes[OUTPUT_MIME_TYPE] = 'application/json';
          processedAttributes[OUTPUT_VALUE] = outputMessages;
        }

        mutableSpan.attributes = { ...processedAttributes, ...mastraOther };
      }

      return mutableSpan;
    });

    super.export(processedSpans, resultCallback);
  }
}
