import { z } from 'zod';

const backgroundTaskMetadataSchema = z.object({
  mastra: z.object({
    backgroundTask: z.object({
      taskId: z.string().min(1),
      status: z.enum(['running', 'completed', 'failed']),
    }),
  }),
});

export function getBackgroundToolMetadata(providerMetadata: unknown) {
  const parsed = backgroundTaskMetadataSchema.safeParse(providerMetadata);
  return parsed.success ? parsed.data.mastra.backgroundTask : undefined;
}
