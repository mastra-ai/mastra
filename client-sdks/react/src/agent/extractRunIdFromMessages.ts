import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { MastraDBMessageMetadata } from '../lib/mastra-db';

/**
 * Scan initial DB-shape messages for any pending approvals, suspended tools, or
 * `requireApprovalMetadata` entries and return the first non-empty `runId`.
 *
 * Metadata is read off `message.content.metadata`, the canonical location for
 * MastraDBMessage UX hints.
 */
export const extractRunIdFromMessages = (messages: MastraDBMessage[]): string | undefined => {
  for (const message of messages) {
    const metadata = message.content?.metadata as MastraDBMessageMetadata | undefined;
    if (!metadata) continue;

    const metadataSources = [
      metadata.pendingToolApprovals,
      metadata.requireApprovalMetadata,
      metadata.suspendedTools,
    ] as Array<Record<string, { runId?: unknown }> | undefined>;

    for (const source of metadataSources) {
      if (!source || typeof source !== 'object') continue;

      for (const entry of Object.values(source)) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.runId === 'string' &&
          entry.runId.length > 0
        ) {
          return entry.runId;
        }
      }
    }
  }

  return undefined;
};
