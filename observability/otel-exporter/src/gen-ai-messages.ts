/**
 * Utilities for converting Mastra messages to OpenTelemetry gen_ai message format
 * Based on OpenTelemetry GenAI semantic conventions
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/#gen-ai-input-messages
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-input-messages.json
 */

/**
 * Type representation of a gen_ai chat message part
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
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: { value: unknown } };

/**
 * Assumed type representation of a Mastra message
 */
type MastraMessage = {
  role: string;
  content: MastraMessagePart[] | string;
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
