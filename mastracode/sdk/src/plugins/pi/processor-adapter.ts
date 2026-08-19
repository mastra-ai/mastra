import type { MastraDBMessage } from '@mastra/core/agent';
import type {
  InputProcessor,
  OutputProcessor,
  ProcessInputArgs,
  ProcessInputResult,
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  ProcessLLMResponseArgs,
} from '@mastra/core/processors';

import { runPiToolResultHooks } from './hook-adapter.js';
import type { PiExtensionGeneration } from './types.js';

export type PiProcessorAdapters = {
  input: InputProcessor[];
  output: OutputProcessor[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): value is MastraDBMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.role === 'string' &&
    isRecord(value.content) &&
    Array.isArray(value.content.parts)
  );
}

function extensionContext(cwd: string, abortSignal?: AbortSignal) {
  return { cwd, mode: 'tui' as const, hasUI: true, signal: abortSignal };
}

async function emitIsolated(
  generation: PiExtensionGeneration,
  event: string,
  payload: unknown,
  context: unknown,
): Promise<unknown[]> {
  generation.assertActive();
  try {
    return await generation.emit(event, payload, context);
  } catch {
    return [];
  }
}

function messageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter(
      (part): part is (typeof message.content.parts)[number] & { type: 'text'; text: string } =>
        part.type === 'text' && 'text' in part && typeof part.text === 'string',
    )
    .map(part => part.text)
    .join('');
}

function messageImages(message: MastraDBMessage): Array<{ type: 'image'; data: string; mimeType: string }> {
  const images: Array<{ type: 'image'; data: string; mimeType: string }> = [];
  for (const part of message.content.parts) {
    if (part.type !== 'file' || typeof part.data !== 'string' || !part.mimeType.startsWith('image/')) continue;
    images.push({ type: 'image', data: part.data, mimeType: part.mimeType });
  }
  return images;
}

function replaceMessageContent(
  message: MastraDBMessage,
  text: string,
  images?: Array<{ type: 'image'; data: string; mimeType: string }>,
): MastraDBMessage {
  const parts = [...message.content.parts];
  const firstText = parts.findIndex(part => part.type === 'text');
  if (firstText >= 0) {
    parts[firstText] = { ...parts[firstText], text } as (typeof parts)[number];
  } else {
    parts.unshift({ type: 'text', text });
  }
  if (images) {
    const nonImages = parts.filter(part => part.type !== 'file' || !part.mimeType.startsWith('image/'));
    parts.splice(
      0,
      parts.length,
      ...nonImages,
      ...images.map(image => ({ type: 'file' as const, data: image.data, mimeType: image.mimeType })),
    );
  }
  return { ...message, content: { ...message.content, parts } };
}

async function processInitialInput(
  generation: PiExtensionGeneration,
  cwd: string,
  args: ProcessInputArgs,
): Promise<ProcessInputResult> {
  let messages = structuredClone(args.messages);
  const context = extensionContext(cwd, args.abortSignal);

  const userIndex = messages.findLastIndex(message => message.role === 'user');
  if (userIndex >= 0) {
    let text = messageText(messages[userIndex]!);
    let images = messageImages(messages[userIndex]!);
    const metadata = isRecord(messages[userIndex]!.content.metadata) ? messages[userIndex]!.content.metadata : {};
    const source =
      metadata.piInputSource === 'rpc' || metadata.piInputSource === 'extension'
        ? metadata.piInputSource
        : 'interactive';
    const streamingBehavior =
      metadata.streamingBehavior === 'steer' || metadata.streamingBehavior === 'followUp'
        ? metadata.streamingBehavior
        : undefined;
    for (const result of await emitIsolated(
      generation,
      'input',
      { type: 'input', text, images, source, streamingBehavior },
      context,
    )) {
      if (!isRecord(result) || typeof result.action !== 'string' || result.action === 'continue') continue;
      if (result.action === 'handled') args.abort(`Pi extension "${generation.extensionId}" handled the input.`);
      if (result.action === 'transform' && typeof result.text === 'string') {
        text = result.text;
        if (Array.isArray(result.images)) {
          images = result.images.filter(
            (image): image is { type: 'image'; data: string; mimeType: string } =>
              isRecord(image) &&
              image.type === 'image' &&
              typeof image.data === 'string' &&
              typeof image.mimeType === 'string',
          );
        }
      }
    }
    messages[userIndex] = replaceMessageContent(messages[userIndex]!, text, images);
  }

  let systemMessages = args.systemMessages;
  const prompt = userIndex >= 0 ? messageText(messages[userIndex]!) : '';
  const systemPrompt = systemMessages
    .map(message => (typeof message.content === 'string' ? message.content : ''))
    .filter(Boolean)
    .join('\n');
  for (const result of await emitIsolated(
    generation,
    'before_agent_start',
    { type: 'before_agent_start', prompt, systemPrompt, systemPromptOptions: {} },
    context,
  )) {
    if (!isRecord(result)) continue;
    if (typeof result.systemPrompt === 'string') systemMessages = [{ role: 'system', content: result.systemPrompt }];
    if (result.message !== undefined) {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" returned a custom before_agent_start message; Mastra Code cannot inject that message at this boundary.`,
        'event:before_agent_start',
      );
    }
  }

  for (const result of await emitIsolated(generation, 'context', { type: 'context', messages }, context)) {
    if (!isRecord(result) || !Array.isArray(result.messages)) continue;
    if (result.messages.every(isMessage)) {
      messages = result.messages;
    } else {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" returned invalid context messages.`,
        'event:context',
      );
    }
  }
  return { messages, systemMessages };
}

async function processProviderRequest(
  generation: PiExtensionGeneration,
  cwd: string,
  args: ProcessLLMRequestArgs,
): Promise<ProcessLLMRequestResult> {
  let prompt = args.prompt;
  for (const result of await emitIsolated(
    generation,
    'before_provider_request',
    { type: 'before_provider_request', payload: prompt },
    extensionContext(cwd, args.abortSignal),
  )) {
    if (Array.isArray(result)) {
      prompt = result as typeof prompt;
    } else if (result !== undefined) {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" returned an invalid before_provider_request payload.`,
        'event:before_provider_request',
      );
    }
  }
  return { prompt };
}

async function processFinalMessages(
  generation: PiExtensionGeneration,
  cwd: string,
  messages: MastraDBMessage[],
  abortSignal?: AbortSignal,
): Promise<MastraDBMessage[]> {
  const next = structuredClone(messages);
  const finalIndex = next.findLastIndex(message => message.role === 'assistant');
  if (finalIndex < 0) return next;
  const original = next[finalIndex]!;
  for (const result of await emitIsolated(
    generation,
    'message_end',
    { type: 'message_end', message: original },
    extensionContext(cwd, abortSignal),
  )) {
    if (!isRecord(result) || result.message === undefined) continue;
    if (!isMessage(result.message)) {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" returned an invalid message_end replacement.`,
        'event:message_end',
      );
      continue;
    }
    if (result.message.role !== original.role) {
      generation.addDiagnostic(
        'warning',
        `Pi extension "${generation.extensionId}" returned a message_end replacement with a different role.`,
        'event:message_end',
      );
      continue;
    }
    next[finalIndex] = result.message as MastraDBMessage;
  }
  return next;
}

function copyResponseHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const headers = Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  if (typeof value.forEach === 'function') {
    try {
      (value.forEach as (callback: (headerValue: string, key: string) => void) => void)((headerValue, key) => {
        headers[key] = headerValue;
      });
    } catch {
      // Provider-specific header facades may reject iteration; enumerable string fields remain available.
    }
  }
  return headers;
}

async function processProviderResponse(
  generation: PiExtensionGeneration,
  cwd: string,
  args: ProcessLLMResponseArgs,
): Promise<void> {
  const response = isRecord(args.rawResponse) ? args.rawResponse : {};
  let chunks: unknown = [];
  try {
    chunks = structuredClone(args.chunks);
  } catch {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" could not receive non-serializable provider response chunks.`,
      'event:after_provider_response:non-serializable',
    );
  }
  await emitIsolated(
    generation,
    'after_provider_response',
    {
      type: 'after_provider_response',
      ...(typeof response.status === 'number' ? { status: response.status } : {}),
      headers: copyResponseHeaders(response.headers),
      chunks,
      fromCache: args.fromCache,
    },
    extensionContext(cwd, args.abortSignal),
  );
}

function normalizeObservedDetails(generation: PiExtensionGeneration, value: unknown, capability: string): unknown {
  if (value === undefined) return undefined;
  try {
    const serialized = JSON.stringify(value, (_key, nested: unknown) => {
      if (nested instanceof Error) return { name: nested.name, message: nested.message, stack: nested.stack };
      return nested;
    });
    if (serialized === undefined) throw new Error('Value is not JSON serializable');
    return JSON.parse(serialized) as unknown;
  } catch {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" received non-serializable tool metadata; Mastra Code omitted it.`,
      capability,
    );
    return undefined;
  }
}

function normalizePiContent(
  generation: PiExtensionGeneration,
  content: unknown[],
  source: 'host' | 'extension',
): unknown[] {
  const normalized = content.map(block => {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
      return { type: 'text', text: block.text };
    }
    if (
      isRecord(block) &&
      block.type === 'image' &&
      typeof block.data === 'string' &&
      typeof block.mimeType === 'string'
    ) {
      return { type: 'image', data: block.data, mimeType: block.mimeType };
    }
    return undefined;
  });
  if (normalized.every(block => block !== undefined)) return normalized;
  generation.addDiagnostic(
    'warning',
    source === 'host'
      ? `Pi extension "${generation.extensionId}" received unsupported host tool-result content; Mastra Code used text fallback.`
      : `Pi extension "${generation.extensionId}" returned unsupported tool-result content; Mastra Code used text fallback.`,
    `event:tool_result:unsupported-${source}-content`,
  );
  try {
    return [{ type: 'text', text: JSON.stringify(content) }];
  } catch {
    return [{ type: 'text', text: String(content) }];
  }
}

function normalizeObservedToolContent(generation: PiExtensionGeneration, result: unknown): unknown[] {
  if (typeof result === 'string') return [{ type: 'text', text: result }];
  try {
    if (isRecord(result) && Array.isArray(result.content)) return result.content;
    return [{ type: 'text', text: JSON.stringify(result) ?? String(result) }];
  } catch {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" received a non-serializable host tool result; Mastra Code provided a text fallback.`,
      'event:tool_result:non-serializable',
    );
    return [{ type: 'text', text: '[Non-serializable host tool result]' }];
  }
}

export function createPiProcessorAdapters(generation: PiExtensionGeneration, cwd: string): PiProcessorAdapters {
  if (generation.hasHandlers('tool_call')) {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" can intercept adapted Pi tools, but Mastra Code does not expose a pre-execution hook for other host tools.`,
      'event:tool_call:host-tools',
    );
  }
  if (generation.hasHandlers('tool_result')) {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" can transform successful host tool results; failed host tool results are observable through tool_execution_end but cannot be rewritten.`,
      'event:tool_result:host-errors',
    );
  }
  const input: InputProcessor = {
    id: `pi:${generation.extensionId}:input`,
    name: `${generation.extensionId} Pi input events`,
    processInput: args => processInitialInput(generation, cwd, args),
    processLLMRequest: args => processProviderRequest(generation, cwd, args),
  };
  const output: OutputProcessor = {
    id: `pi:${generation.extensionId}:output`,
    name: `${generation.extensionId} Pi output events`,
    processLLMResponse: args => processProviderResponse(generation, cwd, args),
    processOutputResult: args => processFinalMessages(generation, cwd, args.messages, args.abortSignal),
    processToolResult: async args => {
      if (generation.registrations.tools.has(args.toolName) || !generation.hasHandlers('tool_result')) return;
      const observedInput = normalizeObservedDetails(generation, args.args, 'event:tool_result:non-serializable-input');
      const hooked = await runPiToolResultHooks(
        generation,
        {
          type: 'tool_result',
          toolCallId: args.toolCallId,
          toolName: args.toolName,
          input: isRecord(observedInput) ? observedInput : {},
          content: normalizePiContent(generation, normalizeObservedToolContent(generation, args.result), 'host'),
          details: normalizeObservedDetails(
            generation,
            isRecord(args.result) ? args.result.details : args.result,
            'event:tool_result:non-serializable-details',
          ),
          isError: false,
        },
        extensionContext(cwd, args.abortSignal),
      );
      if (hooked.isError) {
        generation.addDiagnostic(
          'warning',
          `Pi extension "${generation.extensionId}" marked a successful host tool result as an error; Mastra Code preserved the host execution state.`,
          'event:tool_result:error-rewrite',
        );
      }
      const result = {
        content: normalizePiContent(
          generation,
          normalizeObservedToolContent(generation, { content: hooked.content }),
          'extension',
        ),
        details: normalizeObservedDetails(generation, hooked.details, 'event:tool_result:non-serializable-details'),
        usage: normalizeObservedDetails(generation, hooked.usage, 'event:tool_result:non-serializable-usage'),
      };
      args.messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: args.toolCallId,
          toolName: args.toolName,
          args: isRecord(observedInput) ? observedInput : {},
          result,
        },
      });
      return args.messageList;
    },
  };
  return { input: [input], output: [output] };
}
