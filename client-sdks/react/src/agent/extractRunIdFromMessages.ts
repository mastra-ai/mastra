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
      if (!source || typeof source !== 'object') continue;

      for (const suspensionData of Object.values(source)) {
        if (
          suspensionData &&
          typeof suspensionData === 'object' &&
          typeof (suspensionData as { runId?: unknown }).runId === 'string' &&
          (suspensionData as { runId: string }).runId.length > 0
        ) {
          return (suspensionData as { runId: string }).runId;
        }
      }
    }
  }

  return undefined;
};
