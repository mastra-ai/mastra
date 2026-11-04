import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { DynamicToolPart, ToolInvocationPart } from '../ui/MessageFactory/types';
import type { GenUIToolPhase } from './registry';

/** Tool call fields shared by the `tool-invocation` and `dynamic-tool` / `tool-${name}` part shapes. */
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isErrorResult = (result: unknown) => isRecord(result) && result.isError === true;

export function normalizeToolPart(part: ToolInvocationPart | DynamicToolPart): NormalizedToolCall | undefined {
  if (part.type === 'tool-invocation') {
    const invocation = (part as ToolInvocationPart).toolInvocation as {
      toolCallId?: string;
      toolName?: string;
      state?: string;
      args?: unknown;
      result?: unknown;
      errorText?: string;
      isError?: boolean;
    };
    if (!invocation?.toolCallId || !invocation.toolName) return undefined;
    const argsText = (part as { argsText?: unknown }).argsText;
    let phase: NormalizedToolCall['phase'];
    switch (invocation.state) {
      case 'partial-call':
        phase = 'input-streaming';
        break;
      case 'result':
        phase = invocation.isError || isErrorResult(invocation.result) ? 'output-error' : 'output-available';
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
      toolCallId: invocation.toolCallId,
      toolName: invocation.toolName,
      phase,
      ...(typeof argsText === 'string' ? { argsText } : {}),
      args: invocation.args,
      output: invocation.result,
      ...(invocation.errorText ? { errorText: invocation.errorText } : {}),
    };
  }

  const dynamic = part as DynamicToolPart;
  const toolName = dynamic.toolName ?? (dynamic.type.startsWith('tool-') ? dynamic.type.slice(5) : undefined);
  if (!dynamic.toolCallId || !toolName) return undefined;
  let phase: NormalizedToolCall['phase'];
  switch (dynamic.state) {
    case 'input-streaming':
      phase = 'input-streaming';
      break;
    case 'output-available':
      phase = isErrorResult(dynamic.output) ? 'output-error' : 'output-available';
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
    toolCallId: dynamic.toolCallId,
    toolName,
    phase,
    args: dynamic.input,
    output: dynamic.output,
    ...(dynamic.errorText ? { errorText: dynamic.errorText } : {}),
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
    const metadata = message.content.metadata as Record<string, unknown> | undefined;
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
