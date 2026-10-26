import { createHash } from 'node:crypto';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { z } from 'zod';

import { buildThreadMetadataFromExtractedValues } from './extracted-values';
import type { Extractor } from './extractor';

const pendingValuesBaseSchema = z.object({
  recordId: z.string(),
  reflectedObservationLineCount: z.number(),
  values: z.record(z.string(), z.unknown()),
});
const pendingValuesSchema = z.union([
  pendingValuesBaseSchema.extend({
    reflectionDigest: z.string().regex(/^[a-f0-9]{64}$/),
    reflection: z.never().optional(),
  }),
  pendingValuesBaseSchema.extend({
    reflection: z.string(),
    reflectionDigest: z.never().optional(),
  }),
]);
const metadataSchema = z.record(z.string(), z.unknown());

function reflectionDigest(reflection: string): string {
  return createHash('sha256').update(reflection).digest('hex');
}

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
  const digest = reflectionDigest(record.bufferedReflection);
  await storage.updateThreadMetadata({
    id: record.threadId,
    update: thread => ({
      ...thread.metadata,
      mastra: {
        ...getMastraMetadata(thread.metadata),
        omBufferedReflection: {
          recordId: record.id,
          reflectionDigest: digest,
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
  if (!record.threadId || !record.bufferedReflection) return;
  const digest = reflectionDigest(record.bufferedReflection);
  await storage.updateThreadMetadata({
    id: record.threadId,
    update: thread => {
      const mastra = getMastraMetadata(thread.metadata);
      const parsed = pendingValuesSchema.safeParse(mastra.omBufferedReflection);
      if (!parsed.success) return;
      const pending = parsed.data;
      if (
        pending.recordId !== record.id ||
        (pending.reflectionDigest !== undefined
          ? pending.reflectionDigest !== digest
          : pending.reflection !== record.bufferedReflection) ||
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
