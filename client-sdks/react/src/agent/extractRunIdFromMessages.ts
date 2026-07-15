import type { MastraDBMessage } from '@mastra/core/agent/message-list';

type RunIdMetadataEntry = { runId?: unknown; toolCallId?: unknown };
type RunIdMetadataSource = Record<string, RunIdMetadataEntry>;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';

const runIdMetadataKeys = ['pendingToolApprovals', 'requireApprovalMetadata', 'suspendedTools'] as const;

const isRunIdMetadataSource = (value: unknown): value is RunIdMetadataSource =>
  isRecord(value) && Object.values(value).every(entry => isRecord(entry));

const getRunIdMetadataSources = (metadata: unknown): RunIdMetadataSource[] => {
  if (!isRecord(metadata)) return [];

  const sources: RunIdMetadataSource[] = [];
  for (const key of runIdMetadataKeys) {
    const source = metadata[key];
    if (isRunIdMetadataSource(source)) {
      sources.push(source);
    }
  }
  return sources;
};

/**
 * Scan initial DB-shape messages for pending approvals, suspended tools, or
 * `requireApprovalMetadata` entries and return the latest matching `runId`.
 *
 * Metadata is read off `message.content.metadata`, the canonical location for
 * MastraDBMessage UX hints.
 */
export const extractRunIdFromMessages = (
  messages: MastraDBMessage[],
  pendingToolCallIds?: ReadonlySet<string>,
): string | undefined => {
  for (const message of [...messages].reverse()) {
    for (const source of getRunIdMetadataSources(message.content?.metadata)) {
      for (const entry of Object.values(source)) {
        if (pendingToolCallIds && (typeof entry.toolCallId !== 'string' || !pendingToolCallIds.has(entry.toolCallId))) {
          continue;
        }
        if (isRecord(entry) && typeof entry.runId === 'string' && entry.runId.length > 0) {
          return entry.runId;
        }
      }
    }
  }

  return undefined;
};
