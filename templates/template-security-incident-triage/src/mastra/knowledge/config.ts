import { z } from 'zod';

const RunbookEnvironmentSchema = z.object({
  RUNBOOK_FASTEMBED_CACHE_DIR: z.string().trim().min(1).max(1_024).default('.cache/fastembed'),
});

export function readRunbookConfig(environment: NodeJS.ProcessEnv = process.env): Readonly<{
  fastembedCacheDir: string;
}> {
  const parsed = RunbookEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error('Invalid runbook knowledge configuration.');
  return Object.freeze({
    fastembedCacheDir: parsed.data.RUNBOOK_FASTEMBED_CACHE_DIR,
  });
}
