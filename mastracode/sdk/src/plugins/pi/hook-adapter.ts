import type { PiExtensionGeneration } from './types.js';

export type PiToolCallHookEvent = {
  type: 'tool_call';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
};

export type PiToolCallHookResult = {
  input: Record<string, unknown>;
  blocked: boolean;
  reason?: string;
  terminate: boolean;
};

export type PiToolResultHookEvent = {
  type: 'tool_result';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  content: unknown[];
  details?: unknown;
  isError: boolean;
  usage?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export async function runPiToolCallHooks(
  generation: PiExtensionGeneration,
  event: PiToolCallHookEvent,
  context: unknown,
): Promise<PiToolCallHookResult> {
  const results = await emitIsolated(generation, 'tool_call', event, context);
  const blocked = results.find(result => isRecord(result) && result.block === true);
  const returnedInput = results.findLast(result => isRecord(result) && isRecord(result.input));
  return {
    input: isRecord(returnedInput) && isRecord(returnedInput.input) ? returnedInput.input : event.input,
    blocked: blocked !== undefined,
    reason: isRecord(blocked) && typeof blocked.reason === 'string' ? blocked.reason : undefined,
    terminate: results.some(result => isRecord(result) && result.terminate === true),
  };
}

export async function runPiToolResultHooks(
  generation: PiExtensionGeneration,
  event: PiToolResultHookEvent,
  context: unknown,
): Promise<PiToolResultHookEvent> {
  for (const result of await emitIsolated(generation, 'tool_result', event, context)) {
    if (!isRecord(result)) continue;
    if (Array.isArray(result.content)) event.content = result.content;
    if ('details' in result) event.details = result.details;
    if (typeof result.isError === 'boolean') event.isError = result.isError;
    if ('usage' in result) event.usage = result.usage;
  }
  return event;
}
