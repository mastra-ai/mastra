import { z } from 'zod';

import { validateRetentionTenantId } from '../db/retention-operations.js';

export const retentionIntervalMs = 86_400_000;

const emptyToUndefined = z.preprocess(
  value => (typeof value === 'string' && value.length === 0 ? undefined : value),
  z.coerce.number().int().min(1).max(1_024).optional(),
);
const maxBatches = z.preprocess(
  value => (typeof value === 'string' && value.length === 0 ? undefined : value),
  z.coerce.number().int().min(1).max(64).optional(),
);

const retentionEnvironmentSchema = z.object({
  RETENTION_SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform(value => value === 'true'),
  RETENTION_TENANT_ID: z.string().default(''),
  RETENTION_SWEEP_LIMIT: emptyToUndefined,
  RETENTION_SWEEP_MAX_BATCHES: maxBatches,
});

export type RetentionSchedulerConfig = Readonly<{
  enabled: boolean;
  tenantId?: string;
  limit?: number;
  maxBatchesPerRun?: number;
  intervalMs: 86_400_000;
}>;

/** A disabled scheduler may keep empty settings; enabled scheduling is exact. */
export function readRetentionSchedulerConfig(environment: NodeJS.ProcessEnv = process.env): RetentionSchedulerConfig {
  const parsed = retentionEnvironmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error('RETENTION_SCHEDULER_CONFIG_INVALID');
  const value = parsed.data;
  if (!value.RETENTION_SCHEDULER_ENABLED) return Object.freeze({ enabled: false, intervalMs: retentionIntervalMs });

  try {
    validateRetentionTenantId(value.RETENTION_TENANT_ID);
  } catch {
    throw new Error('RETENTION_SCHEDULER_CONFIG_INVALID');
  }
  if (value.RETENTION_SWEEP_LIMIT == null || value.RETENTION_SWEEP_MAX_BATCHES == null)
    throw new Error('RETENTION_SCHEDULER_CONFIG_INVALID');
  return Object.freeze({
    enabled: true,
    tenantId: value.RETENTION_TENANT_ID,
    limit: value.RETENTION_SWEEP_LIMIT,
    maxBatchesPerRun: value.RETENTION_SWEEP_MAX_BATCHES,
    intervalMs: retentionIntervalMs,
  });
}
