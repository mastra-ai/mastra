import { DurableStepIds } from '../../agent/durable/constants';
import type { MastraDBMessage } from '../../agent/message-list';
import type { Mastra } from '../../mastra';
import { createToolInputState } from '../../tools/resumable-input';
import type { AcceptedToolInput } from '../../tools/resumable-input';
import type { WorkflowRunState } from '../../workflows/types';

function suspendedPayloads(snapshot: WorkflowRunState | null | undefined): Record<string, any>[] {
  return Object.values(snapshot?.context ?? {}).flatMap((step: any) => {
    if (step?.status !== 'suspended' || !step.suspendPayload) return [];
    const iterations = step.suspendPayload.__workflow_meta?.foreachOutput;
    return [
      step.suspendPayload,
      ...(iterations
        ? Object.values(iterations).flatMap((entry: any) =>
            entry?.status === 'suspended' ? [entry.suspendPayload] : [],
          )
        : []),
    ];
  });
}

/** Recover private input from the original native run, never from model-supplied arguments. */
export async function loadAutoResumeToolInput({
  mastra,
  messages,
  toolCallId,
  toolName,
  suspendedToolRunId,
  resourceId,
  threadId,
  agentId,
  durable,
}: {
  mastra?: Mastra;
  messages: MastraDBMessage[];
  toolCallId: string;
  toolName: string;
  suspendedToolRunId?: unknown;
  resourceId?: string;
  threadId?: string;
  agentId: string;
  durable: boolean;
}): Promise<AcceptedToolInput | undefined> {
  const candidates = new Map<string, Record<string, any>>();
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant') continue;
    for (const entry of Object.values(message.content.metadata?.suspendedTools ?? {}) as Record<string, any>[]) {
      if ((entry?.parentToolName ?? entry?.toolName) !== toolName || typeof entry.runId !== 'string') continue;
      if (
        suspendedToolRunId != null &&
        entry.runId !== suspendedToolRunId &&
        entry.delegatedRunId !== suspendedToolRunId
      )
        continue;
      const key = `${entry.runId}:${entry.toolCallId}`;
      if (typeof entry.toolCallId === 'string' && !candidates.has(key)) candidates.set(key, entry);
    }
  }
  const exact = [...candidates.values()].filter(entry => entry.toolCallId === toolCallId);
  const matches = exact.length ? exact : [...candidates.values()];
  if (!matches.length) return undefined; // Legacy metadata can lack a tool-call identity.
  if (matches.length !== 1) throw new Error('Multiple suspended calls match this tool. Resume an exact tool call.');
  const target = matches[0]!;
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!store) return undefined;
  const workflowName = durable ? DurableStepIds.AGENTIC_LOOP : 'agentic-loop';
  const record = await store.getWorkflowRunById({ workflowName, runId: target.runId });
  if (!record) return undefined;
  if (record.resourceId !== resourceId) throw new Error('Suspended tool input belongs to a different resource.');
  const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId: target.runId });
  if (!snapshot) return undefined;
  const payloads = suspendedPayloads(snapshot);
  const input = snapshot?.context?.input as Record<string, any> | undefined;
  const ownerPayload = payloads.find(payload => payload.__agentId && payload.__streamState);
  const ownerAgent = durable ? input?.agentId : ownerPayload?.__agentId;
  const memory = durable ? input?.messageListState?.memoryInfo : ownerPayload?.__streamState?.messageList?.memoryInfo;
  if (ownerAgent !== agentId || memory?.threadId !== threadId || memory?.resourceId !== resourceId) {
    throw new Error('Suspended tool input does not belong to this agent and conversation.');
  }
  const execution = durable
    ? await store.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_EXECUTION, runId: target.runId })
    : snapshot;
  const payload = suspendedPayloads(execution).find(
    payload => (payload.toolCallId ?? payload.requireToolApproval?.toolCallId) === target.toolCallId,
  );
  const accepted = createToolInputState(payload).accepted;
  if (accepted && (accepted.toolName !== toolName || accepted.toolCallId !== target.toolCallId)) {
    throw new Error('Suspended tool input does not match the original invocation.');
  }
  return accepted;
}
