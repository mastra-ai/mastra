import { z } from 'zod';

// Shared admission limits supplement each run's execution policy.
export const serviceLimits = z
  .object({
    maxMutationsPerMinute: z.int().positive(),
    maxActiveJobs: z.int().positive(),
    maxDailyCalls: z.int().positive(),
    maxDailyReservedUsd: z.number().positive(),
  })
  .strict()
  .parse({
    maxMutationsPerMinute: 60,
    maxActiveJobs: 2,
    maxDailyCalls: 10_000,
    maxDailyReservedUsd: 50,
  });
