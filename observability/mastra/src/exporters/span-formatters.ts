/**
 * Utility span formatters for common use cases.
 *
 * These formatters can be used with the `customSpanFormatter` option on
 * TrackingExporter-based exporters (Braintrust, Langfuse, etc.).
 */

import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, ExporterSpanFormatter } from '@mastra/core/observability';

/**
 * AI SDK message content part interface.
 * Supports text, tool-call, tool-result, and other content types.
 */
interface ContentPart {
  type: string;
  text?: string;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
  result?: unknown;
  output?: unknown;
}

/**
 * AI SDK message interface.
 * Used in both v4 and v5 formats.
 */
interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  [key: string]: unknown;
}

/**
 * Checks if a value looks like an AI SDK message array.
 */
function isMessageArray(value: unknown): value is AIMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    'role' in value[0]
  );
}

/**
 * Extracts text content from an AI SDK message.
 *
 * Handles:
 * - Simple string content
 * - Array of content parts (AI SDK format)
 * - Nested text fields
 */
function extractMessageText(message: AIMessage): string {
  const { content } = message;

  // Simple string content
  if (typeof content === 'string') {
    return content;
  }

  // Array of content parts
  if (Array.isArray(content)) {
    const textParts: string[] = [];

    for (const part of content) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (part && typeof part === 'object') {
        if (part.type === 'text' && typeof part.text === 'string') {
          textParts.push(part.text);
        } else if (typeof part.content === 'string') {
          textParts.push(part.content);
        }
      }
    }

    return textParts.join('\n');
  }

  return '';
}

/**
 * Extracts the user's input message text from a message array.
 *
 * Finds the last 'user' role message and extracts its text content.
 * Returns undefined if no user message is found.
 */
function extractUserInputText(messages: AIMessage[]): string | undefined {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'user') {
      return extractMessageText(msg);
    }
  }
  return undefined;
}

/**
 * Extracts the assistant's output message text from a message array.
 *
 * Finds the last 'assistant' role message and extracts its text content.
 * Returns undefined if no assistant message is found.
 */
function extractAssistantOutputText(messages: AIMessage[]): string | undefined {
  // Find the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'assistant') {
      return extractMessageText(msg);
    }
  }
  return undefined;
}

/**
 * Extracts plain text from span output.
 *
 * Handles various output formats:
 * - String output (returns as-is)
 * - Object with 'text' field
 * - Array of messages (extracts last assistant message)
 */
function extractOutputText(output: unknown): string | undefined {
  if (typeof output === 'string') {
    return output;
  }

  if (output && typeof output === 'object') {
    // Handle { text: "..." } format
    if ('text' in output && typeof (output as any).text === 'string') {
      return (output as any).text;
    }

    // Handle { content: "..." } format
    if ('content' in output && typeof (output as any).content === 'string') {
      return (output as any).content;
    }

    // Handle message array format
    if (isMessageArray(output)) {
      return extractAssistantOutputText(output);
    }
  }

  return undefined;
}

/**
 * Creates a span formatter that extracts plain text from AI SDK message arrays.
 *
 * This formatter is useful for making traces more readable in observability platforms
 * like Braintrust and Langfuse, where raw JSON payloads can be difficult to read.
 *
 * The formatter:
 * - Extracts the last user message text for input
 * - Extracts text from the output (handles various formats)
 * - Only modifies spans of the specified types
 *
 * @param options - Configuration options
 * @param options.spanTypes - Array of span types to format (default: AGENT_RUN only)
 * @param options.formatInput - Whether to format input (default: true)
 * @param options.formatOutput - Whether to format output (default: true)
 *
 * @example
 * ```typescript
 * const braintrustExporter = new BraintrustExporter({
 *   customSpanFormatter: createPlainTextFormatter(),
 * });
 *
 * // Or with custom options:
 * const formatter = createPlainTextFormatter({
 *   spanTypes: [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION],
 *   formatInput: true,
 *   formatOutput: true,
 * });
 * ```
 */
export function createPlainTextFormatter(options: {
  spanTypes?: SpanType[];
  formatInput?: boolean;
  formatOutput?: boolean;
} = {}): ExporterSpanFormatter {
  const {
    spanTypes = [SpanType.AGENT_RUN],
    formatInput = true,
    formatOutput = true,
  } = options;

  const targetTypes = new Set(spanTypes);

  return (span: AnyExportedSpan): AnyExportedSpan => {
    // Only format specified span types
    if (!targetTypes.has(span.type)) {
      return span;
    }

    let modifiedSpan = span;

    // Format input if enabled and input is a message array
    if (formatInput && isMessageArray(span.input)) {
      const plainTextInput = extractUserInputText(span.input);
      if (plainTextInput !== undefined) {
        modifiedSpan = {
          ...modifiedSpan,
          input: plainTextInput,
        };
      }
    }

    // Format output if enabled
    if (formatOutput && span.output !== undefined) {
      const plainTextOutput = extractOutputText(span.output);
      if (plainTextOutput !== undefined) {
        modifiedSpan = {
          ...modifiedSpan,
          output: plainTextOutput,
        };
      }
    }

    return modifiedSpan;
  };
}

/**
 * Composes multiple span formatters into a single formatter.
 *
 * Formatters are applied in order, with each receiving the output of the previous.
 *
 * @param formatters - Array of formatters to compose
 * @returns A single formatter that applies all formatters in sequence
 *
 * @example
 * ```typescript
 * const composedFormatter = composeFormatters([
 *   createPlainTextFormatter(),
 *   myCustomRedactionFormatter,
 * ]);
 *
 * const exporter = new BraintrustExporter({
 *   customSpanFormatter: composedFormatter,
 * });
 * ```
 */
export function composeFormatters(formatters: ExporterSpanFormatter[]): ExporterSpanFormatter {
  return (span: AnyExportedSpan): AnyExportedSpan => {
    return formatters.reduce((currentSpan, formatter) => formatter(currentSpan), span);
  };
}
