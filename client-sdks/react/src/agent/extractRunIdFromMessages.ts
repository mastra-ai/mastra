import type { ExtendedMastraUIMessage } from '../lib/ai-sdk';

// Extract runId from any pending approvals or suspended tools in initial messages.
export const extractRunIdFromMessages = (messages: ExtendedMastraUIMessage[]): string | undefined => {
  for (const message of messages) {
    const metadataSources = [
      message.metadata?.pendingToolApprovals,
      message.metadata?.requireApprovalMetadata,
      message.metadata?.suspendedTools,
    ] as Array<Record<string, any> | undefined>;

    for (const source of metadataSources) {
      if (source && typeof source === 'object') {
        const suspensionData = Object.values(source)[0];
        if (suspensionData?.runId) {
          return suspensionData.runId;
        }
      }
    }
  }

  return undefined;
};
