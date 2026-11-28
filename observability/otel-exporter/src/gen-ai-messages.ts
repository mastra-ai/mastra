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
    }
  | {
      type: 'reasoning';
      content: string;
    };

/**
 * Type representation of a gen_ai chat message
 */
type GenAIMessage = {
  role: string;
  parts: GenAIMessagePart[];
  /** Required on output messages, absent on input messages. */
  finish_reason?: string;
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
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: { value: unknown } }
  | { type: 'reasoning'; text: string };

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
    (p.type === 'text' || p.type === 'tool-call' || p.type === 'tool-result' || p.type === 'reasoning') &&
    ((p.type === 'text' && 'text' in p) ||
      (p.type === 'reasoning' && 'text' in p) ||
      (p.type === 'tool-call' && 'toolCallId' in p && 'toolName' in p && 'input' in p) ||
      // A tool result is recognized by its call, not by its `output`: a `toModelOutput`
      // callback can return `null`, a primitive or an object with no `value`. That only makes
      // the *part* inexpressible — `toGenAIMessagePart` skips it — and must not cost the
      // message its other parts.
      (p.type === 'tool-result' && 'toolCallId' in p && 'toolName' in p))
  );
};

/**
 * A message is convertible when its role and *recorded* content are recognizable. Content is
 * recognized as the parts array it is recorded as — including an empty one, which is how a turn
 * with nothing to say is recorded — or as the string it serializes to, since the span IO is read
 * back through JSON. A result without a readable value is not itself a reason to disown the
 * message: the caller skips that part, not the payload, and a turn genuinely recorded with no
 * parts converts to one with none.
 */
const isMastraMessage = (m: unknown): m is MastraMessage => {
  return (
    typeof m === 'object' &&
    m != null &&
    'role' in m &&
    'content' in m &&
    isRecordedContent((m as { content: unknown }).content)
  );
};

const isRecordedContent = (content: unknown): boolean => {
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.every(isMastraMessagePart);
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
const toGenAIMessage = (m: MastraMessage, finishReason?: string): GenAIMessage | undefined => {
  if (!Array.isArray(m.content))
    return withFinishReason({ role: m.role, parts: [{ type: 'text', content: m.content }] }, finishReason);
  // A turn recorded with no parts is a turn with nothing to say; it converts to a message with
  // none. A turn whose parts merely became inexpressible has no such record to go on, so callers
  // keep it as it was written instead of exporting a message that drops them.
  if (m.content.length === 0) return withFinishReason({ role: m.role, parts: [] }, finishReason);
  const parts = m.content.map(toGenAIMessagePart).filter((p): p is GenAIMessagePart => p !== undefined);
  if (parts.length === 0) return undefined;
  return withFinishReason({ role: m.role, parts }, finishReason);
};

/**
 * Model output as recorded on MODEL_STEP / MODEL_INFERENCE spans: `{ text, toolCalls }`
 * (a tool-only step has `text: ''`), plus `responseMessages` when the span kept the
 * provider messages for the step.
 */
type MastraModelOutput = {
  text?: unknown;
  toolCalls?: unknown;
  responseMessages?: unknown;
};

const toGenAIOutputMessage = (output: MastraModelOutput, finishReason?: string): GenAIMessage => {
  const parts: GenAIMessagePart[] = [];
  const toolCalls = Array.isArray(output.toolCalls) ? output.toolCalls : [];
  const text = typeof output.text === 'string' ? output.text : undefined;
  // Keep the text part unless it is empty and the step was tool-only.
  if (text !== undefined && (text.length > 0 || toolCalls.length === 0)) {
    parts.push({ type: 'text', content: text });
  }
  for (const call of toolCalls) {
    if (typeof call !== 'object' || call == null) continue;
    const c = call as { toolCallId?: unknown; toolName?: unknown; args?: unknown; input?: unknown };
    parts.push({
      type: 'tool_call',
      id: String(c.toolCallId ?? ''),
      name: String(c.toolName ?? ''),
      arguments: JSON.stringify(c.args ?? c.input),
    });
  }
  return withFinishReason({ role: 'assistant', parts }, finishReason);
};

/**
 * Serialize a part's value for a gen_ai field, or `undefined` when it cannot be read.
 * `JSON.stringify` returns `undefined` for `undefined`/functions and throws on circular
 * values; either way the part cannot be expressed.
 */
const serializeValue = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value) ?? undefined;
  } catch {
    return undefined;
  }
};

const withFinishReason = (message: GenAIMessage, finishReason: string | undefined): GenAIMessage =>
  finishReason === undefined ? message : { ...message, finish_reason: finishReason };

/**
 * Map one Mastra content part, validating its shape. Returns `undefined` for a part
 * that is not one gen_ai can express, or whose fields are unusable, so its supported
 * siblings are kept instead of the whole message being dropped.
 */
const toGenAIMessagePart = (part: unknown): GenAIMessagePart | undefined => {
  if (typeof part !== 'object' || part === null) return undefined;
  const p = part as Record<string, unknown>;
  switch (p.type) {
    case 'text':
      return typeof p.text === 'string' ? { type: 'text', content: p.text } : undefined;
    case 'reasoning':
      return typeof p.text === 'string' ? { type: 'reasoning', content: p.text } : undefined;
    case 'tool-call': {
      if (typeof p.toolCallId !== 'string' || typeof p.toolName !== 'string') return undefined;
      // A call whose arguments never arrived has no part gen_ai can express. Emitting it
      // would put an `arguments: undefined` part on the span and keep the message from
      // falling back to the summary, so it is skipped like any other unusable part.
      const args = serializeValue(p.input);
      return args === undefined
        ? undefined
        : { type: 'tool_call', id: p.toolCallId, name: p.toolName, arguments: args };
    }
    case 'tool-result': {
      if (typeof p.toolCallId !== 'string' || typeof p.toolName !== 'string') return undefined;
      // A result with no readable value is skipped rather than failing the message.
      const output = p.output;
      if (typeof output !== 'object' || output === null || !('value' in output)) return undefined;
      const response = serializeValue((output as { value: unknown }).value);
      if (response === undefined) return undefined;
      return { type: 'tool_call_response', id: p.toolCallId, name: p.toolName, response };
    }
    default:
      return undefined;
  }
};

/** Map a provider response message leniently, skipping parts it cannot express. */
const toGenAIResponseMessage = (m: unknown, finishReason?: string): GenAIMessage | undefined => {
  if (typeof m !== 'object' || m === null) return undefined;
  const { role, content } = m as { role?: unknown; content?: unknown };
  if (typeof role !== 'string') return undefined;
  const parts: GenAIMessagePart[] =
    typeof content === 'string'
      ? [{ type: 'text', content }]
      : Array.isArray(content)
        ? content.map(toGenAIMessagePart).filter((p): p is GenAIMessagePart => p !== undefined)
        : [];
  if (parts.length === 0) return undefined;
  return withFinishReason({ role, parts }, finishReason);
};

/** Returns `undefined` when the value is not in a shape that maps to messages. */
const convert = (inputOutputString: string, finishReason?: string): string | undefined => {
  try {
    const parsedIO = JSON.parse(inputOutputString) as unknown;
    if (typeof parsedIO !== 'object' || parsedIO == null) {
      return undefined;
    }
    // A bare message list: the shallow prompt preview recorded on
    // MODEL_STEP / MODEL_INFERENCE spans.
    if (Array.isArray(parsedIO)) {
      if (!parsedIO.every(isMastraMessage)) return undefined;
      const messages = parsedIO.map(m => toGenAIMessage(m, finishReason));
      // A message with no expressible part leaves the whole payload as recorded, rather than
      // exporting a list with parts missing from it.
      return messages.every((m): m is GenAIMessage => m !== undefined) ? JSON.stringify(messages) : undefined;
    }
    // The provider messages the step produced, when the span kept them: they carry
    // reasoning and provider-executed tool results the `{ text, toolCalls }` summary
    // drops, so they win. Anything unusable falls through to the summary below.
    if ('responseMessages' in parsedIO) {
      const responseMessages = (parsedIO as MastraModelOutput).responseMessages;
      if (Array.isArray(responseMessages) && responseMessages.length > 0) {
        const messages = responseMessages
          .map(m => toGenAIResponseMessage(m, finishReason))
          .filter((m): m is GenAIMessage => m !== undefined);
        if (messages.length > 0) {
          return JSON.stringify(messages);
        }
      }
    }
    // Model output `{ text, toolCalls }` becomes one assistant message with a
    // text part and a tool_call part per tool call.
    if ('text' in parsedIO || 'toolCalls' in parsedIO) {
      return JSON.stringify([toGenAIOutputMessage(parsedIO as MastraModelOutput, finishReason)]);
    }
    // if the IO contains messages, convert them to gen_ai messages
    if ('messages' in parsedIO && Array.isArray(parsedIO.messages)) {
      return JSON.stringify(
        (parsedIO.messages as unknown[]).map(m => {
          if (!isMastraMessage(m)) return m;
          // A message with no expressible part is kept as it was recorded.
          return toGenAIMessage(m, finishReason) ?? m;
        }),
      );
    }
    return undefined;
  } catch {
    return undefined;
  }
};

// Mastra records AI SDK finish reasons. The output messages schema spells these two differently.
const GENAI_FINISH_REASONS: Record<string, string> = { 'tool-calls': 'tool_call', 'content-filter': 'content_filter' };

/**
 * Convert model output to `gen_ai.output.messages`. Each output message must carry a
 * `finish_reason`, so an unrecorded reason is sent as `unknown`, as Mastra's loop does.
 */
export const convertMastraOutputToGenAIMessages = (outputString: string, finishReason: string | undefined): string => {
  const reason = finishReason ? (GENAI_FINISH_REASONS[finishReason] ?? finishReason) : 'unknown';
  return (
    convert(outputString, reason) ??
    JSON.stringify([withFinishReason({ role: 'assistant', parts: [{ type: 'text', content: outputString }] }, reason)])
  );
};

export const convertMastraMessagesToGenAIMessages = (inputString: string): string =>
  convert(inputString) ?? inputString;
