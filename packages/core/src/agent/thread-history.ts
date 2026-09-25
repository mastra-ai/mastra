import type { MastraDBMessage } from './message-list/types';

/**
 * Epoch ms at which a broadcast stream part was produced by the model output.
 * Publishing can lag production, so the stamp travels with the `stream-part`
 * event; remote parts from older publishers fall back to the event time.
 */
const partProducedAt = new WeakMap<object, number>();

export function stampPartProducedAt(part: unknown, at: number) {
  if (part && typeof part === 'object') partProducedAt.set(part, at);
}

export function getPartProducedAt(part: unknown): number | undefined {
  return part && typeof part === 'object' ? partProducedAt.get(part) : undefined;
}

function toEpoch(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date || typeof value === 'string') {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : undefined;
  }
  return undefined;
}

type ThreadHistoryIndex = {
  /** Latest stored change per message id. */
  stamps: Map<string, number>;
  /** Tool calls still waiting on the user (approval or suspension). */
  pendingToolCallIds: Set<string>;
};

export function indexThreadHistory(messages: MastraDBMessage[]): ThreadHistoryIndex {
  const stamps = new Map<string, number>();
  const pendingToolCallIds = new Set<string>();
  for (const message of messages) {
    let stamp = toEpoch(message.createdAt) ?? 0;
    for (const part of message.content?.parts ?? []) {
      const timed = part as { createdAt?: unknown; updatedAt?: unknown };
      stamp = Math.max(stamp, toEpoch(timed.createdAt) ?? 0, toEpoch(timed.updatedAt) ?? 0);
    }
    stamps.set(message.id, stamp);
    const metadata = message.content?.metadata as Record<string, unknown> | undefined;
    for (const key of ['pendingToolApprovals', 'suspendedTools']) {
      const entries = metadata?.[key];
      if (!entries || typeof entries !== 'object') continue;
      for (const [id, entry] of Object.entries(entries)) {
        const toolCallId = (entry as { toolCallId?: unknown } | undefined)?.toolCallId;
        pendingToolCallIds.add(typeof toolCallId === 'string' ? toolCallId : id);
      }
    }
  }
  return { stamps, pendingToolCallIds };
}

/**
 * Decides, per streamed part, whether stored history already covers it. Parts
 * are attributed to the assistant message announced by the latest `start` /
 * `step-start` of their run; a part no later than that message's newest
 * stored change is dropped, including parts saved while history was being
 * read. Pending approval and suspension chunks always pass: controllers build
 * their prompts from them.
 */
export function createThreadHistoryFilter(messages: MastraDBMessage[]) {
  const { stamps, pendingToolCallIds } = indexThreadHistory(messages);
  const messageIdByRun = new Map<string, string>();

  return (part: unknown, runId: string): boolean => {
    if (!part || typeof part !== 'object') return true;
    const typed = part as {
      type?: string;
      payload?: { messageId?: unknown; toolCallId?: unknown; updatedAt?: unknown };
    };
    if ((typed.type === 'start' || typed.type === 'step-start') && typeof typed.payload?.messageId === 'string') {
      messageIdByRun.set(runId, typed.payload.messageId);
    }
    if (
      (typed.type === 'tool-call-approval' || typed.type === 'tool-call-suspended') &&
      typeof typed.payload?.toolCallId === 'string' &&
      pendingToolCallIds.has(typed.payload.toolCallId)
    ) {
      return true;
    }
    // Signals are stored as their own message under the signal's id.
    if (typed.type === 'data-signal' || typed.type === 'data-user-message') {
      const signalId = (part as { data?: { id?: unknown } }).data?.id;
      return !(typeof signalId === 'string' && stamps.has(signalId));
    }
    const producedAt = partProducedAt.get(part);
    if (producedAt === undefined) return true;
    const messageId = messageIdByRun.get(runId);
    const stamp = messageId ? stamps.get(messageId) : undefined;
    if (stamp === undefined) return true;
    const changedAt = toEpoch(typed.payload?.updatedAt) ?? producedAt;
    return changedAt > stamp;
  };
}
