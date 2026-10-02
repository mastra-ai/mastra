import { z } from 'zod';
import type { OperationalStore } from '../db/operational-store.js';

export const ObservationSchema = z.object({
  sequence: z.coerce.number().int().positive(),
  tenant_id: z.string().min(1),
  incident_id: z.string().min(1),
  kind: z.enum(['workflow', 'approval', 'provider', 'containment', 'evidence-source']),
  entity_id: z.string().min(1),
  status: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  triaged: z.coerce.number().int().min(0).max(1),
  trace_present: z.coerce.number().int().min(0).max(1),
  observed_at: z.string().nullable(),
});
export type Observation = z.infer<typeof ObservationSchema>;

/** A customer driver must atomically commit rows and cursor, isolate tenants,
 * deduplicate source/tenant/sequence and never mutate operational authority. */
export interface AnalyticsStore {
  cursor(source: string, tenant: string): Promise<number>;
  append(source: string, tenant: string, after: number, rows: readonly Observation[]): Promise<void>;
  observations(source: string, tenant: string): Promise<Observation[]>;
  close(): void;
}

export async function exportAnalytics(source: OperationalStore, target: AnalyticsStore, tenant: string) {
  if (!tenant.trim()) throw new Error('TENANT_REQUIRED');
  const identity = await source.execute({
    sql: 'SELECT id FROM analytics_source_identity',
  });
  if (identity.rows.length !== 1) throw new Error('ANALYTICS_SOURCE_IDENTITY_INVALID');
  const sourceId = String(identity.rows[0]!.id);
  let after = await target.cursor(sourceId, tenant);
  let exported = 0;
  for (;;) {
    const page = await source.execute({
      sql: `SELECT * FROM analytics_journal WHERE tenant_id = ? AND sequence > ? ORDER BY sequence LIMIT 500`,
      args: [tenant, after],
    });
    const rows = page.rows.map(row => ObservationSchema.parse(row));
    if (!rows.length) return { sourceId, exported, cursor: after };
    await target.append(sourceId, tenant, after, rows);
    after = rows.at(-1)!.sequence;
    exported += rows.length;
  }
}
