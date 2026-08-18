import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import type { MastraDBMessageMetadata } from './types';

type NetworkPrimitiveType = 'agent' | 'workflow' | 'tool';

export interface NetworkPrimitiveResult {
  isNetwork: true;
  primitiveType: NetworkPrimitiveType;
  primitiveId: string;
  selectionReason?: string;
  input?: unknown;
  finalResult?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseNetworkPrimitiveResult = (value: unknown): NetworkPrimitiveResult | null => {
  if (typeof value !== 'string') return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.isNetwork !== true) return null;
    if (parsed.primitiveType !== 'agent' && parsed.primitiveType !== 'workflow' && parsed.primitiveType !== 'tool') {
      return null;
    }
    if (typeof parsed.primitiveId !== 'string' || parsed.primitiveId.length === 0) return null;
    return parsed as unknown as NetworkPrimitiveResult;
  } catch {
    return null;
  }
};

const primitiveFrom = (primitiveType: NetworkPrimitiveType): NonNullable<MastraDBMessageMetadata['from']> => {
  if (primitiveType === 'agent') return 'AGENT';
  if (primitiveType === 'workflow') return 'WORKFLOW';
  return 'TOOL';
};

const approvalEntryFor = (metadata: MastraDBMessageMetadata, primitiveId: string) =>
  metadata.requireApprovalMetadata?.[primitiveId] ??
  metadata.pendingToolApprovals?.[primitiveId] ??
  metadata.suspendedTools?.[primitiveId];

const resultOutput = (result: NetworkPrimitiveResult): unknown => {
  if (result.primitiveType === 'workflow') {
    const finalResult = isRecord(result.finalResult) ? result.finalResult : undefined;
    const runResult = isRecord(finalResult?.runResult) ? finalResult.runResult : result.finalResult;
    if (!isRecord(runResult)) return runResult;
    const runId = typeof finalResult?.runId === 'string' ? finalResult.runId : undefined;
    return { ...runResult, ...(runId ? { runId } : {}) };
  }

  if (result.primitiveType === 'tool' && isRecord(result.finalResult) && 'result' in result.finalResult) {
    return result.finalResult.result;
  }

  return result.finalResult;
};

const resultToolCallId = (
  result: NetworkPrimitiveResult,
  message: MastraDBMessage,
  existingPart?: Record<string, unknown>,
): string => {
  const metadata = (message.content.metadata ?? {}) as MastraDBMessageMetadata;
  const approvalToolCallId = approvalEntryFor(metadata, result.primitiveId)?.toolCallId;
  if (typeof approvalToolCallId === 'string') return approvalToolCallId;

  if (result.primitiveType === 'workflow' && isRecord(result.finalResult)) {
    const runId = result.finalResult.runId;
    if (typeof runId === 'string') return runId;
  }

  if (result.primitiveType === 'tool' && isRecord(result.finalResult)) {
    const toolCallId = result.finalResult.toolCallId;
    if (typeof toolCallId === 'string') return toolCallId;
  }

  return typeof existingPart?.toolCallId === 'string' ? existingPart.toolCallId : message.id;
};

const isMatchingDynamicTool = (part: MastraMessagePart, result: NetworkPrimitiveResult): boolean => {
  const candidate = part as unknown as Record<string, unknown>;
  return candidate.type === 'dynamic-tool' && candidate.toolName === result.primitiveId;
};

const isMatchingEnvelopeText = (part: MastraMessagePart, result: NetworkPrimitiveResult): boolean => {
  if (part.type !== 'text') return false;
  const parsed = parseNetworkPrimitiveResult(part.text);
  return parsed?.primitiveType === result.primitiveType && parsed.primitiveId === result.primitiveId;
};

/**
 * Turn the JSON envelope persisted by agent-network primitives back into the
 * dynamic-tool part consumed by React renderers. If the live stream already
 * created that part, it is finalized in place and its richer streamed output
 * (for example sub-agent child messages) is retained.
 */
export const applyNetworkPrimitiveResult = (
  message: MastraDBMessage,
  result: NetworkPrimitiveResult,
): MastraDBMessage => {
  const metadata = (message.content.metadata ?? {}) as MastraDBMessageMetadata;
  const isPending = Boolean(approvalEntryFor(metadata, result.primitiveId));
  let replaced = false;

  const parts = message.content.parts.flatMap(part => {
    if (isMatchingEnvelopeText(part, result)) return [];
    if (!isMatchingDynamicTool(part, result) || replaced) return [part];

    replaced = true;
    const existingPart = part as unknown as Record<string, unknown>;
    const nextOutput = resultOutput(result);
    const existingOutput = existingPart.output;
    const output =
      isRecord(existingOutput) && isRecord(nextOutput)
        ? result.primitiveType === 'agent'
          ? { ...nextOutput, ...existingOutput }
          : { ...existingOutput, ...nextOutput }
        : nextOutput;

    return [
      {
        type: 'dynamic-tool',
        toolName: result.primitiveId,
        toolCallId: resultToolCallId(result, message, existingPart),
        state: isPending ? 'input-available' : 'output-available',
        input: result.input ?? existingPart.input,
        ...(!isPending ? { output } : {}),
      } as unknown as MastraMessagePart,
    ];
  });

  if (!replaced) {
    parts.push({
      type: 'dynamic-tool',
      toolName: result.primitiveId,
      toolCallId: resultToolCallId(result, message),
      state: isPending ? 'input-available' : 'output-available',
      input: result.input,
      ...(!isPending ? { output: resultOutput(result) } : {}),
    } as unknown as MastraMessagePart);
  }

  const routingDecision = {
    isNetwork: true,
    primitiveType: result.primitiveType,
    primitiveId: result.primitiveId,
    ...(result.selectionReason ? { selectionReason: result.selectionReason } : {}),
    ...(result.input !== undefined ? { input: result.input } : {}),
  };

  return {
    ...message,
    content: {
      ...message.content,
      parts,
      metadata: {
        ...metadata,
        mode: 'network',
        from: primitiveFrom(result.primitiveType),
        selectionReason: result.selectionReason ?? metadata.selectionReason,
        agentInput: result.input ?? metadata.agentInput,
        routingDecision,
      },
    },
  };
};

export const normalizePersistedNetworkResults = (message: MastraDBMessage): MastraDBMessage => {
  const metadata = message.content.metadata as MastraDBMessageMetadata | undefined;
  if (message.role !== 'assistant' || metadata?.mode !== 'network') return message;

  return message.content.parts.reduce((normalized, part) => {
    if (part.type !== 'text') return normalized;
    const result = parseNetworkPrimitiveResult(part.text);
    return result ? applyNetworkPrimitiveResult(normalized, result) : normalized;
  }, message);
};
