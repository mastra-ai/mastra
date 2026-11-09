import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { parsePartialJson } from '../utils/ai-sdk-v4/parse-partial-json';
import type { GenUIToolPhase } from './definition';
import { isJSONObject } from './json';
import type { JSONObject } from './json';

/**
 * Tool call fields shared by the `tool-invocation` and `dynamic-tool` / `tool-${name}` part shapes.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface NormalizedToolCall {
  toolCallId: string;
  toolName: string;
  phase: Exclude<GenUIToolPhase, 'awaiting-approval' | 'suspended'>;
  /** Raw streamed argument text while the call is still `input-streaming`. */
  argsText?: string;
  args: unknown;
  output: unknown;
  errorText?: string;
}

/** Arguments so far: repaired from the streamed text while the model writes them, the parsed input afterwards. */
export function partialArgsOf(call: NormalizedToolCall): JSONObject | undefined {
  const value =
    call.phase === 'input-streaming' && call.argsText !== undefined ? parsePartialJson(call.argsText).value : call.args;
  return isJSONObject(value) ? value : undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isErrorResult = (result: unknown) => isRecord(result) && result.isError === true;

const field = (source: object, key: string): unknown => (key in source ? Reflect.get(source, key) : undefined);
const stringField = (source: object, key: string) => {
  const value = field(source, key);
  return typeof value === 'string' ? value : undefined;
};

/**
 * Read a tool part from a live or stored message. Parts are read field by field because hydrated
 * history and streaming runtimes carry fields (`argsText`, `errorText`, `dynamic-tool`) the static
 * part types do not declare.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function normalizeToolPart(part: { type: string }): NormalizedToolCall | undefined {
  if (part.type === 'tool-invocation') {
    const invocation = field(part, 'toolInvocation');
    if (!isRecord(invocation)) return undefined;
    const toolCallId = stringField(invocation, 'toolCallId');
    const toolName = stringField(invocation, 'toolName');
    if (!toolCallId || !toolName) return undefined;
    const argsText = stringField(part, 'argsText');
    const errorText = stringField(invocation, 'errorText');
    let phase: NormalizedToolCall['phase'];
    switch (invocation.state) {
      case 'partial-call':
        phase = 'input-streaming';
        break;
      case 'result':
        phase = invocation.isError === true || isErrorResult(invocation.result) ? 'output-error' : 'output-available';
        break;
      case 'output-error':
        phase = 'output-error';
        break;
      case 'output-denied':
        phase = 'output-denied';
        break;
      default:
        phase = 'input-available';
    }
    return {
      toolCallId,
      toolName,
      phase,
      ...(argsText !== undefined ? { argsText } : {}),
      args: invocation.args,
      output: invocation.result,
      ...(errorText ? { errorText } : {}),
    };
  }

  if (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')) return undefined;
  const toolCallId = stringField(part, 'toolCallId');
  const toolName = stringField(part, 'toolName') ?? (part.type.startsWith('tool-') ? part.type.slice(5) : undefined);
  if (!toolCallId || !toolName) return undefined;
  const output = field(part, 'output');
  const errorText = stringField(part, 'errorText');
  let phase: NormalizedToolCall['phase'];
  switch (field(part, 'state')) {
    case 'input-streaming':
      phase = 'input-streaming';
      break;
    case 'output-available':
      phase = isErrorResult(output) ? 'output-error' : 'output-available';
      break;
    case 'output-error':
      phase = 'output-error';
      break;
    case 'output-denied':
      phase = 'output-denied';
      break;
    default:
      phase = 'input-available';
  }
  return {
    toolCallId,
    toolName,
    phase,
    args: field(part, 'input'),
    output,
    ...(errorText ? { errorText } : {}),
  };
}

export interface ToolCallMeta {
  kind: 'approval' | 'suspended';
  toolName: string;
  suspendPayload?: unknown;
}

/**
 * Collect pending approvals and suspensions from message metadata, keyed by tool call id.
 * Live streams store them in `requireApprovalMetadata`; hydrated history in `pendingToolApprovals`.
 */
export function collectToolCallMeta(messages: ReadonlyArray<MastraDBMessage>): Map<string, ToolCallMeta> {
  const meta = new Map<string, ToolCallMeta>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const metadata = message.content.metadata;
    if (!metadata) continue;
    for (const key of ['requireApprovalMetadata', 'pendingToolApprovals', 'suspendedTools'] as const) {
      const entries = metadata[key];
      if (!isRecord(entries)) continue;
      for (const [entryKey, entry] of Object.entries(entries)) {
        if (!isRecord(entry)) continue;
        const toolCallId = typeof entry.toolCallId === 'string' ? entry.toolCallId : entryKey;
        const toolName = typeof entry.toolName === 'string' ? entry.toolName : entryKey;
        meta.set(
          toolCallId,
          key === 'suspendedTools'
            ? { kind: 'suspended', toolName, suspendPayload: entry.suspendPayload }
            : { kind: 'approval', toolName },
        );
      }
    }
  }
  return meta;
}
