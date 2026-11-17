import type { MastraClient } from '@mastra/client-js';

export function buildReplayPreview(turnCount: number): Awaited<ReturnType<MastraClient['previewReplayDataset']>> {
  return { turnCount, historyLimit: 10 };
}

export function buildReplayCreated(turnCount: number): Awaited<ReturnType<MastraClient['addDatasetItemsFromThread']>> {
  return { itemIds: Array.from({ length: turnCount }, (_, index) => `turn-${index + 1}`), turnCount };
}
