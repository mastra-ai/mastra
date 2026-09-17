import type { MastraDBMessage } from '../../agent/message-list';
import { resolveSuspendedToolRunId } from '../../agent/utils';

type ResumeSource = 'framework' | 'model';

type SuspendedToolCandidate = {
  toolCallId?: string;
  toolName: string;
  runId: string;
  type: 'approval' | 'suspension';
};

export type ResolveSuspendedToolRunIdOptions = {
  toolCallId: string;
  toolName: string;
  resumeSource: ResumeSource;
  modelSuppliedSuspendedToolCallId?: unknown;
  modelSuppliedSuspendedToolRunId?: unknown;
  suspendData?: unknown;
  messages: ReadonlyArray<MastraDBMessage>;
};

function candidateFromEntry(
  entry: unknown,
  fallbackToolCallId: string | undefined,
  fallbackType: SuspendedToolCandidate['type'],
): SuspendedToolCandidate | undefined {
  if (!entry || typeof entry !== 'object') return undefined;

  const value = entry as Record<string, unknown>;
  const type = value.type === 'approval' || value.type === 'suspension' ? value.type : fallbackType;
  const toolName =
    typeof value.parentToolName === 'string'
      ? value.parentToolName
      : typeof value.toolName === 'string'
        ? value.toolName
        : undefined;
  if (!toolName) return undefined;

  // Approval metadata stores the outer resumable run in `runId`. Only a
  // delegated approval has an inner run that a generated tool may resume.
  const runId = resolveSuspendedToolRunId(
    type === 'approval' ? value.delegatedRunId : (value.delegatedRunId ?? value.runId),
  );
  if (!runId) return undefined;

  return {
    toolCallId: typeof value.toolCallId === 'string' ? value.toolCallId : fallbackToolCallId,
    toolName,
    runId,
    type,
  };
}

function collectCandidates(messages: ReadonlyArray<MastraDBMessage>): SuspendedToolCandidate[] {
  const candidates: SuspendedToolCandidate[] = [];

  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant') continue;

    const metadata = message.content.metadata as
      | {
          suspendedTools?: Record<string, unknown>;
          pendingToolApprovals?: Record<string, unknown>;
        }
      | undefined;

    for (const [key, entry] of Object.entries(metadata?.suspendedTools ?? {})) {
      const candidate = candidateFromEntry(entry, key, 'suspension');
      if (candidate) candidates.push(candidate);
    }
    for (const [key, entry] of Object.entries(metadata?.pendingToolApprovals ?? {})) {
      const candidate = candidateFromEntry(entry, key, 'approval');
      if (candidate) candidates.push(candidate);
    }

    for (const part of message.content.parts ?? []) {
      if (
        (part.type !== 'data-tool-call-suspended' && part.type !== 'data-tool-call-approval') ||
        (part.data as { resumed?: boolean }).resumed
      ) {
        continue;
      }
      const candidate = candidateFromEntry(
        part.data,
        undefined,
        part.type === 'data-tool-call-approval' ? 'approval' : 'suspension',
      );
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        other =>
          other.toolCallId === candidate.toolCallId &&
          other.toolName === candidate.toolName &&
          other.runId === candidate.runId &&
          other.type === candidate.type,
      ) === index,
  );
}

function uniqueCandidate(candidates: SuspendedToolCandidate[]): SuspendedToolCandidate | undefined {
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Resolves delegated run identity only from framework-persisted suspension state.
 * Model-driven resumes identify an original suspended tool call; the framework
 * derives its delegated run ID from the matching persisted suspension.
 */
export function resolveFrameworkSuspendedToolRunId({
  toolCallId,
  toolName,
  resumeSource,
  modelSuppliedSuspendedToolCallId,
  modelSuppliedSuspendedToolRunId,
  suspendData,
  messages,
}: ResolveSuspendedToolRunIdOptions): string | undefined {
  const suspendPayloadRunId = resolveSuspendedToolRunId(
    suspendData && typeof suspendData === 'object'
      ? (suspendData as { suspendedToolRunId?: unknown }).suspendedToolRunId
      : undefined,
  );
  if (resumeSource === 'framework' && suspendPayloadRunId) return suspendPayloadRunId;

  const candidates = collectCandidates(messages).filter(candidate => candidate.toolName === toolName);

  if (resumeSource === 'framework') {
    const exactCandidate = uniqueCandidate(candidates.filter(candidate => candidate.toolCallId === toolCallId));
    if (exactCandidate) return exactCandidate.runId;

    return uniqueCandidate(candidates)?.runId;
  }

  const suspendedToolCallId = resolveSuspendedToolRunId(modelSuppliedSuspendedToolCallId)?.trim();
  if (!suspendedToolCallId) return undefined;

  const matchingSuspension = uniqueCandidate(
    candidates.filter(candidate => candidate.type === 'suspension' && candidate.toolCallId === suspendedToolCallId),
  );
  if (!matchingSuspension) return undefined;

  const modelRunIdClaim = resolveSuspendedToolRunId(modelSuppliedSuspendedToolRunId);
  if (modelRunIdClaim && modelRunIdClaim !== matchingSuspension.runId) return undefined;

  return matchingSuspension.runId;
}
