import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { SemanticConventions } from '@arizeai/openinference-semantic-conventions';

export const isOpenInferenceSpan = (span: ReadableSpan) => {
  const maybeOpenInferenceSpanKind = span.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND];
  return typeof maybeOpenInferenceSpanKind === 'string';
};

// Code copied from the link below. Mastra uses a custom tracing wrapper,
// so this just uses the standards under the hood.
// https://github.com/mastra-ai/mastra/blob/b8fd400083e6dd919e6627cfaf89eedd8c8d0e0a/observability/arize/src/openInferenceOTLPExporter.ts
class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      // Only process AI spans
      if (!isOpenInferenceSpan(span)) {
        return span;
      }

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

export const ARIZE_AX_ENDPOINT = 'https://otlp.arize.com/v1/traces';

export type ArizeOpenInferenceOTLPTraceExporterConfig = {
  /**
   * Required if sending traces to Arize AX
   */
  spaceId?: string;
  /**
   * Required if sending traces to Arize AX, or to any other collector that
   * requires an Authorization header
   */
  apiKey?: string;
  /**
   * Collector endpoint destination for trace exports.
   * Required when sending traces to Phoenix, Phoenix Cloud, or other collectors.
   * Optional when sending traces to Arize AX.
   */
  endpoint?: string;
  /**
   * Optional project name to be added as a resource attribute using
   * OpenInference Semantic Conventions
   */
  projectName?: string;
  /**
   * Optional headers to be added to each OTLP request
   */
  headers?: Record<string, string>;
};

export class ArizeOpenInferenceOTLPTraceExporter extends OpenInferenceOTLPTraceExporter {
  private exportCount = 0;

  constructor(config: ArizeOpenInferenceOTLPTraceExporterConfig) {
    let endpoint: string | undefined = config.endpoint;
    const headers: Record<string, string> = {
      ...config.headers,
    };
    if (config.spaceId) {
      // arize ax header configuration
      headers.space_id = config.spaceId;
      headers.api_key = config.apiKey ?? '';
      endpoint = config.endpoint || ARIZE_AX_ENDPOINT;
    } else if (config.apiKey) {
      // standard otel header configuration
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    super({
      url: endpoint,
      headers,
    });

    // Log configuration for debugging
    console.log('Arize exporter initialized', {
      endpoint,
      hasSpaceId: !!config.spaceId,
      hasApiKey: !!config.apiKey,
      projectName: config.projectName,
    });
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    this.exportCount++;

    // Call parent export with wrapped callback to log failures only
    const wrappedCallback = (result: ExportResult) => {
      if (result.code !== 0) {
        console.log(`Arize export #${this.exportCount} failed`, {
          code: result.code,
          error: result.error,
          spanCount: spans.length,
        });
      }
      resultCallback(result);
    };

    super.export(spans, wrappedCallback);
  }
}

/**
 * Type represenation of a gen_ai chat message part
 */
type GenAIMessagePart =
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      arguments: string;
    }
  | {
      type: 'tool_call_response';
      id: string;
      name: string;
      response: string;
    };

/**
 * Type representation of a gen_ai chat message
 */
type GenAIMessage = {
  role: string;
  parts: GenAIMessagePart[];
};

/**
 * Assumed type representation of a Mastra message content type
 */
type MastraMessagePart =
  | {
      type: 'text';
      text: string;
    }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      output: { value: unknown };
    };

/**
 * Assumed type representation of a Mastra message
 */
type MastraMessage = {
  role: string;
  content: MastraMessagePart[];
};

const isMastraMessagePart = (p: unknown): p is MastraMessagePart => {
  return (
    typeof p === 'object' &&
    p != null &&
    'type' in p &&
    (p.type === 'text' || p.type === 'tool-call' || p.type === 'tool-result') &&
    ((p.type === 'text' && 'text' in p) ||
      (p.type === 'tool-call' && 'toolCallId' in p && 'toolName' in p && 'input' in p) ||
      (p.type === 'tool-result' && 'toolCallId' in p && 'toolName' in p && 'output' in p))
  );
};

const isMastraMessage = (m: unknown): m is MastraMessage => {
  return (
    typeof m === 'object' &&
    m != null &&
    'role' in m &&
    'content' in m &&
    (typeof m.content === 'string' || (Array.isArray(m.content) && m.content.every(isMastraMessagePart)))
  );
};

/**
 * Convert an Input/Output string from a MastraSpan into a jsonified string that adheres to
 * OpenTelemetry gen_ai.input.messages and gen_ai.output.messages schema.
 * If parsing fails at any step, the original inputOutputString is returned unmodified.
 *
 * This conversion is best effort; It assumes a consistent shape for mastra messages, and converts
 * into the gen_ai input and output schemas as of October 20th, 2025.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/#gen-ai-input-messages
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-input-messages.json
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/#gen-ai-output-messages
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-output-messages.json
 *
 * @param inputOutputString a jsonified string that contains messages adhering to what appears to be
 * Mastra's message shape.
 * @returns a jsonified string that contains messages adhering to the OpenTelemetry gen_ai.input.messages and gen_ai.output.messages schema.
 * If parsing fails at any step, the original inputOutputString is returned unmodified.
 */
export const convertMastraMessagesToGenAIMessages = (inputOutputString: string): string => {
  try {
    const parsedIO = JSON.parse(inputOutputString) as unknown;
    if (typeof parsedIO !== 'object' || parsedIO == null || (!('messages' in parsedIO) && !('text' in parsedIO))) {
      // inputOutputString fails initial type guard, just return it
      return inputOutputString;
    }
    // if the IO simply contains a text string, return a single text message
    // formatted as a gen_ai assistant message, assuming its an assistant response
    if ('text' in parsedIO) {
      return JSON.stringify([
        {
          role: 'assistant',
          parts: [{ type: 'text', content: parsedIO.text as string }],
        } satisfies GenAIMessage,
      ]);
    }
    // if the IO contains messages, convert them to gen_ai messages
    if (Array.isArray(parsedIO.messages)) {
      return JSON.stringify(
        (parsedIO.messages as unknown[]).map(m => {
          if (!isMastraMessage(m)) {
            return m;
          }
          const role = m.role;
          let parts: GenAIMessagePart[] = [];
          if (Array.isArray(m.content)) {
            parts = m.content.map(c => {
              switch (c.type) {
                case 'text':
                  return {
                    type: 'text',
                    content: c.text,
                  };
                case 'tool-call':
                  return {
                    type: 'tool_call',
                    id: c.toolCallId,
                    name: c.toolName,
                    arguments: JSON.stringify(c.input),
                  };
                case 'tool-result':
                  return {
                    type: 'tool_call_response',
                    id: c.toolCallId,
                    name: c.toolName,
                    response: JSON.stringify(c.output.value),
                  };
                default:
                  return c;
              }
            });
          } else {
            parts = [
              {
                type: 'text',
                content: m.content,
              },
            ];
          }
          return {
            role,
            parts,
          } satisfies GenAIMessage;
        }),
      );
    }
    // we've failed type-guards, just return original I/O string
    return inputOutputString;
  } catch {
    // silently fallback to original I/O string
    return inputOutputString;
  }
};
