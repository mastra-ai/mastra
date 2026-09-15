import { isDeepStrictEqual } from 'node:util';
import { decode, encode } from '../events/codec/codec';

/** Internal, per-invocation state. Never included in a tool's public context or transcript. */
export const TOOL_INPUT_STATE = Symbol('mastra.toolInputState');

export type AcceptedToolInput = { encoded: string; toolName?: string; toolCallId?: string };

export interface ToolInputState {
  accepted?: AcceptedToolInput;
  captureError?: unknown;
}

export interface ToolInputOptions {
  [TOOL_INPUT_STATE]?: ToolInputState;
}

export function createToolInputState(suspendData: unknown): ToolInputState {
  const accepted = (suspendData as { __mastraToolInput?: AcceptedToolInput } | undefined)?.__mastraToolInput;
  return { accepted: accepted ? { ...accepted } : undefined };
}

export function captureToolInput(
  options: ToolInputOptions | undefined,
  input: unknown,
  identity?: { toolName: string; toolCallId?: string },
): void {
  const state = options?.[TOOL_INPUT_STATE];
  if (state?.accepted && identity) state.accepted = { ...state.accepted, ...identity };
  if (state && !state.accepted) {
    try {
      // Use the native codec so Date, Map, Set and explicit undefined survive
      // JSON-backed workflow stores too. A string prevents a transport codec
      // from decoding this snapshot before the tool is resumed.
      const encoded = JSON.stringify(encode(input));
      if (!isDeepStrictEqual(input, decode(JSON.parse(encoded)))) {
        throw new Error('Tool input contains values that cannot survive native snapshot storage.');
      }
      state.accepted = { encoded, ...identity };
    } catch (error) {
      // Non-suspending tools are not subject to snapshot persistence constraints.
      state.captureError = error;
    }
  }
}

export function persistedToolInput(state: ToolInputState): AcceptedToolInput | undefined {
  if (state.captureError) throw new Error('Cannot persist suspended tool input', { cause: state.captureError });
  return state.accepted;
}

export function restoreToolInput(options: ToolInputOptions | undefined, rawInput: unknown, delegated = false): unknown {
  const accepted = options?.[TOOL_INPUT_STATE]?.accepted;
  if (!accepted) return rawInput; // Snapshots written before accepted input was persisted.
  const input = decode(JSON.parse(accepted.encoded));
  // Delegation routing is supplied by the current native resume, not by the
  // original invocation. Keep it separate from the saved tool input.
  if (
    delegated &&
    input &&
    typeof input === 'object' &&
    rawInput &&
    typeof rawInput === 'object' &&
    'suspendedToolRunId' in rawInput
  ) {
    return { ...input, suspendedToolRunId: rawInput.suspendedToolRunId };
  }
  return input;
}
