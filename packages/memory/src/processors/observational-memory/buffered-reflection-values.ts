import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { z } from 'zod';

import { buildThreadMetadataFromExtractedValues } from './extracted-values';
import type { Extractor } from './extractor';

const pendingValuesSchema = z.object({
  recordId: z.string(),
  reflection: z.string(),
  reflectedObservationLineCount: z.number(),
  values: z.record(z.string(), z.unknown()),
});
const metadataSchema = z.record(z.string(), z.unknown());

function getMastraMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  const parsed = metadataSchema.safeParse(metadata?.mastra);
  return parsed.success ? parsed.data : {};
}

/** Keep prepared values outside active OM metadata, durable across Memory instances. */
export async function stageBufferedReflectionValues(
  storage: MemoryStorage,
  record: ObservationalMemoryRecord,
  values: Record<string, unknown> | undefined,
): Promise<void> {
  if (!record.threadId || !record.bufferedReflection) return;
  await storage.updateThreadMetadata({
    id: record.threadId,
    update: thread => ({
      ...thread.metadata,
      mastra: {
        ...getMastraMetadata(thread.metadata),
        omBufferedReflection: {
          recordId: record.id,
          reflection: record.bufferedReflection,
          reflectedObservationLineCount: record.reflectedObservationLineCount ?? 0,
          values: values ?? {},
        },
      },
    }),
  });
}

/** Called under the OM commit lock, only after this exact buffer was activated. */
export async function publishBufferedReflectionValues(
  storage: MemoryStorage,
  extractors: readonly Extractor<any>[],
  record: ObservationalMemoryRecord,
): Promise<void> {
  if (!record.threadId) return;
  await storage.updateThreadMetadata({
    id: record.threadId,
    update: thread => {
      const mastra = getMastraMetadata(thread.metadata);
      const parsed = pendingValuesSchema.safeParse(mastra.omBufferedReflection);
      if (!parsed.success) return;
      const pending = parsed.data;
      if (
        pending.recordId !== record.id ||
        pending.reflection !== record.bufferedReflection ||
        pending.reflectedObservationLineCount !== (record.reflectedObservationLineCount ?? 0)
      )
        return;

      const update = buildThreadMetadataFromExtractedValues(extractors, pending.values);
      const previous = getThreadOMMetadata(thread.metadata);
      const metadata = setThreadOMMetadata(thread.metadata, {
        currentTask: update.currentTask ?? previous?.currentTask,
        suggestedResponse: update.suggestedResponse ?? previous?.suggestedResponse,
        threadTitle: update.threadTitle ?? previous?.threadTitle,
        extracted: { ...previous?.extracted, ...update.extracted },
      });
      return {
        ...metadata,
        mastra: { ...getMastraMetadata(metadata), omBufferedReflection: null },
      };
    },
  });
}
