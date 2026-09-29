import { randomUUID } from 'node:crypto';

import type { OperationalStore, StoreTransaction } from './operational-store.js';
import { isCanonicalTenantId } from '../schemas/common.js';

const thirtyDaysMs = 30 * 86_400_000;
const yearMs = 365 * 86_400_000;

type RetentionDisposition = 'deleted' | 'minimized' | 'retained-authority';
type RetentionClass = 'thirty-day' | 'three-hundred-sixty-five-day';

type RetentionCandidate = Readonly<{
  source: string;
  sourceIdentity: string;
  tenantId?: string;
  agedAt: string;
  retentionClass: RetentionClass;
  disposition: RetentionDisposition;
  target:
    | Readonly<{ kind: 'record'; id: string }>
    | Readonly<{
        kind: 'provider-effect-ledger';
        provider: string;
        idempotencyKey: string;
      }>;
}>;

export type RetentionSweepResult = Readonly<{
  sweepId: string;
  dryRun: boolean;
  scanned: number;
  deleted: number;
  minimized: number;
  retainedAuthority: number;
}>;

/**
 * Applies the approved local retention matrix in a single, bounded
 * transaction. GeoIP is deliberately owned by the integration runtime's
 * purgeExpiredGeoIpCache: purge_after is already its retention deadline.
 * Authority tables are never deleted; their tombstone makes the policy
 * boundary visible without breaking foreign keys or append-only audit.
 */
export async function sweepRetention(
  store: OperationalStore,
  input: Readonly<{
    now: Date;
    limit: number;
    dryRun?: boolean;
    tenantId?: string;
    sweepId?: string;
  }>,
): Promise<RetentionSweepResult> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 1_024)
    throw new Error('RETENTION_LIMIT_INVALID');
  const tenantId = validateRetentionTenantId(input.tenantId);

  const now = input.now.toISOString();
  const sweepId = input.sweepId ?? `retention:${randomUUID()}`;
  const dryRun = input.dryRun ?? false;
  const thirtyDayCutoff = new Date(input.now.getTime() - thirtyDaysMs).toISOString();
  const yearCutoff = new Date(input.now.getTime() - yearMs).toISOString();

  return store.transaction(async tx => {
    const candidates = await selectCandidates(tx, {
      thirtyDayCutoff,
      yearCutoff,
      limit: input.limit,
      tenantId,
      advanceCursor: !dryRun,
    });

    if (dryRun) return countCandidates(sweepId, true, candidates);
    const applied: RetentionCandidate[] = [];
    for (const candidate of candidates) {
      const claimed = await tx.execute({
        sql: `INSERT INTO retention_tombstone_claims(
          source, source_identity, tenant_id, retention_class, disposition, aged_at, tombstoned_at, sweep_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, tenant_id, source_identity) DO NOTHING`,
        args: [
          candidate.source,
          candidate.sourceIdentity,
          candidate.tenantId ?? null,
          candidate.retentionClass,
          candidate.disposition,
          candidate.agedAt,
          now,
          sweepId,
        ],
      });
      if (claimed.rowsAffected !== 1) continue;
      await applyCandidate(tx, candidate);
      applied.push(candidate);
    }
    const result = countCandidates(sweepId, false, applied);
    // Claims are the append-only evidence for retained audit rows. Emitting an
    // audit event while processing only audit events would self-replicate at a
    // bounded limit, so operational work gets one summary and audit-only work
    // relies on its factual claim.
    if (applied.some(candidate => candidate.source !== 'retention_audit_events'))
      await writeAudit(tx, sweepId, tenantId, now, result);
    return result;
  });
}

function countCandidates(
  sweepId: string,
  dryRun: boolean,
  candidates: readonly RetentionCandidate[],
): RetentionSweepResult {
  return {
    sweepId,
    dryRun,
    scanned: candidates.length,
    deleted: candidates.filter(candidate => candidate.disposition === 'deleted').length,
    minimized: candidates.filter(candidate => candidate.disposition === 'minimized').length,
    retainedAuthority: candidates.filter(candidate => candidate.disposition === 'retained-authority').length,
  };
}

async function writeAudit(
  tx: StoreTransaction,
  sweepId: string,
  tenantId: string,
  occurredAt: string,
  result: RetentionSweepResult,
) {
  await tx.execute({
    sql: `INSERT INTO retention_audit_events(id, sweep_id, tenant_id, event, dry_run, occurred_at, detail_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `retention-audit:${randomUUID()}`,
      `retention-summary:${sweepId}`,
      tenantId,
      'completed',
      0,
      occurredAt,
      JSON.stringify({
        scanned: result.scanned,
        deleted: result.deleted,
        minimized: result.minimized,
        retainedAuthority: result.retainedAuthority,
      }),
    ],
  });
}

async function selectCandidates(
  tx: StoreTransaction,
  input: Readonly<{
    thirtyDayCutoff: string;
    yearCutoff: string;
    limit: number;
    tenantId: string;
    advanceCursor: boolean;
  }>,
): Promise<readonly RetentionCandidate[]> {
  const tenantPredicate = ' AND tenant_id = ?';
  const tenantArgs = [input.tenantId];
  const sources: Array<Readonly<{ source: string; sql: string; args: readonly string[] }>> = [
    recordSource(
      'evidence_items',
      'evidence_items',
      'collected_at',
      'deleted',
      `collected_at <= ?${tenantPredicate}`,
      input.thirtyDayCutoff,
      tenantArgs,
      input.limit,
    ),
    recordSource(
      'retention_audit_events',
      'retention_audit_events',
      'occurred_at',
      'retained-authority',
      `tenant_id IS NOT NULL AND occurred_at <= ?${tenantPredicate}`,
      input.yearCutoff,
      tenantArgs,
      input.limit,
      'three-hundred-sixty-five-day',
    ),
    recordSource(
      'dead_letter_events',
      'dead_letter_events',
      'resolved_at',
      'deleted',
      `resolved_at IS NOT NULL AND resolved_at <= ?${tenantPredicate}`,
      input.thirtyDayCutoff,
      tenantArgs,
      input.limit,
    ),
    recordSource(
      'workflow_runs.trace',
      'workflow_runs',
      'finished_at',
      'minimized',
      `trace_context_json IS NOT NULL AND finished_at IS NOT NULL AND finished_at <= ?${tenantPredicate}`,
      input.thirtyDayCutoff,
      tenantArgs,
      input.limit,
    ),
    recordSource(
      'provider_deliveries.projection',
      'provider_deliveries',
      'observed_at',
      'minimized',
      `projection_json IS NOT NULL AND observed_at IS NOT NULL AND observed_at <= ?${tenantPredicate}`,
      input.thirtyDayCutoff,
      tenantArgs,
      input.limit,
    ),
    ...authoritySources(input.yearCutoff, input.limit, tenantPredicate, tenantArgs),
  ];
  const cursor = await readSourceCursor(tx, input.tenantId);
  const candidates: RetentionCandidate[] = [];
  for (const source of rotateSources(sources, cursor)) {
    if (candidates.length >= input.limit) break;
    const rows = await tx.execute({ sql: source.sql, args: source.args });
    for (const row of rows.rows) {
      if (candidates.length >= input.limit) break;
      candidates.push(candidateFromRow(row));
    }
  }
  if (input.advanceCursor) await writeSourceCursor(tx, input.tenantId, nextSourceCursor(sources, cursor, candidates));
  return candidates;
}

async function readSourceCursor(tx: StoreTransaction, tenantId: string): Promise<number> {
  const result = await tx.execute({
    sql: 'SELECT next_source FROM retention_source_cursors WHERE tenant_id = ?',
    args: [tenantId],
  });
  return Number(result.rows[0]?.next_source ?? 0);
}

async function writeSourceCursor(tx: StoreTransaction, tenantId: string, nextSource: number): Promise<void> {
  await tx.execute({
    sql: `INSERT INTO retention_source_cursors(tenant_id, next_source) VALUES (?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET next_source = excluded.next_source`,
    args: [tenantId, String(nextSource)],
  });
}

function rotateSources<T>(sources: readonly T[], offset: number): readonly T[] {
  const normalized = ((offset % sources.length) + sources.length) % sources.length;
  return [...sources.slice(normalized), ...sources.slice(0, normalized)];
}

function nextSourceCursor(
  sources: readonly Readonly<{ source: string }>[],
  cursor: number,
  candidates: readonly RetentionCandidate[],
): number {
  const selected = sources.findIndex(source => source.source === candidates.at(-1)?.source);
  return ((selected === -1 ? cursor : selected) + 1) % sources.length;
}

function recordSource(
  source: string,
  table: string,
  agedAt: string,
  disposition: RetentionDisposition,
  predicate: string,
  cutoff: string,
  tenantArgs: readonly string[],
  limit: number,
  retentionClass: RetentionClass = 'thirty-day',
) {
  return {
    source,
    sql: `SELECT '${source}' AS source, json_array(id) AS source_identity,
      id AS target_id, tenant_id, ${agedAt} AS aged_at,
      '${retentionClass}' AS retention_class, '${disposition}' AS disposition
      FROM ${table} WHERE ${predicate}${unclaimed(source, 'json_array(id)')}
      ORDER BY ${agedAt}, id LIMIT ?`,
    args: [cutoff, ...tenantArgs, String(limit)],
  };
}

function unclaimed(source: string, sourceIdentity: string): string {
  return ` AND NOT EXISTS (
    SELECT 1 FROM retention_tombstone_claims claim
      WHERE claim.source = '${source}' AND claim.source_identity = ${sourceIdentity}
  )`;
}

function unclaimedConsumer(source: string, sourceIdentity: string): string {
  return ` AND NOT EXISTS (
    SELECT 1 FROM retention_tombstone_claims claim
      WHERE claim.source = '${source}'
        AND claim.tenant_id = consumer_effect_ledger.tenant_id
        AND claim.source_identity = ${sourceIdentity}
  )`;
}

function authoritySources(cutoff: string, limit: number, tenantPredicate: string, tenantArgs: readonly string[]) {
  const retained = "'three-hundred-sixty-five-day' AS retention_class, 'retained-authority' AS disposition";
  return [
    {
      source: 'timeline_events',
      sql: `SELECT 'timeline_events' AS source, json_array(id) AS source_identity,
        id AS target_id, tenant_id, occurred_at AS aged_at, ${retained}
        FROM timeline_events WHERE occurred_at <= ?${tenantPredicate}${unclaimed(
          'timeline_events',
          'json_array(id)',
        )} ORDER BY occurred_at, id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'containment_action_attempts',
      sql: `SELECT 'containment_action_attempts' AS source, json_array(id) AS source_identity,
        id AS target_id, tenant_id, finished_at AS aged_at, ${retained}
        FROM containment_action_attempts WHERE finished_at IS NOT NULL AND finished_at <= ?${tenantPredicate}${unclaimed(
          'containment_action_attempts',
          'json_array(id)',
        )} ORDER BY finished_at, id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'approvals',
      sql: `SELECT 'approvals' AS source, json_array(id) AS source_identity,
        id AS target_id, tenant_id, requested_at AS aged_at, ${retained}
        FROM approvals WHERE requested_at <= ?${tenantPredicate}${unclaimed(
          'approvals',
          'json_array(id)',
        )} ORDER BY requested_at, id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'containment_actions',
      sql: `SELECT 'containment_actions' AS source, json_array(a.id) AS source_identity,
        a.id AS target_id, a.tenant_id, p.created_at AS aged_at, ${retained}
        FROM containment_actions a JOIN containment_plans p ON p.tenant_id=a.tenant_id AND p.incident_id=a.incident_id AND p.id=a.plan_id
        WHERE p.created_at <= ?${tenantPredicate.replaceAll('tenant_id', 'a.tenant_id')}${unclaimed(
          'containment_actions',
          'json_array(a.id)',
        )} ORDER BY p.created_at, a.id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'containment_gateway_audit',
      sql: `SELECT 'containment_gateway_audit' AS source, json_array(id) AS source_identity,
        id AS target_id, claimed_tenant_id AS tenant_id, occurred_at AS aged_at, ${retained}
        FROM containment_gateway_audit WHERE occurred_at <= ?${tenantPredicate.replaceAll('tenant_id', 'claimed_tenant_id')}${unclaimed(
          'containment_gateway_audit',
          'json_array(id)',
        )} ORDER BY occurred_at, id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'approval_decision_audit',
      sql: `SELECT 'approval_decision_audit' AS source, json_array(id) AS source_identity,
        id AS target_id, claimed_tenant_id AS tenant_id, occurred_at AS aged_at, ${retained}
        FROM approval_decision_audit WHERE occurred_at <= ?${tenantPredicate.replaceAll('tenant_id', 'claimed_tenant_id')}${unclaimed(
          'approval_decision_audit',
          'json_array(id)',
        )} ORDER BY occurred_at, id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'provider_effect_ledger',
      sql: `SELECT 'provider_effect_ledger' AS source,
        json_array(provider, idempotency_key) AS source_identity,
        provider, idempotency_key, tenant_id, claimed_at AS aged_at, ${retained}
        FROM provider_effect_ledger WHERE claimed_at <= ?${tenantPredicate}${unclaimed(
          'provider_effect_ledger',
          'json_array(provider, idempotency_key)',
        )} ORDER BY claimed_at, provider, idempotency_key LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
    {
      source: 'consumer_effect_ledger',
      sql: `SELECT 'consumer_effect_ledger' AS source,
        json_array(consumer_group, event_id) AS source_identity, event_id AS target_id,
        consumer_group, event_id, tenant_id, completed_at AS aged_at, ${retained}
        FROM consumer_effect_ledger
        WHERE status IN ('completed', 'dead_lettered')
          AND completed_at IS NOT NULL AND completed_at <= ?${tenantPredicate}${unclaimedConsumer(
            'consumer_effect_ledger',
            'json_array(consumer_group, event_id)',
          )} ORDER BY completed_at, consumer_group, event_id LIMIT ?`,
      args: [cutoff, ...tenantArgs, String(limit)],
    },
  ];
}

/** Validates a tenant boundary without rewriting the caller's identity. */
export function validateRetentionTenantId(tenantId: string | undefined): string {
  if (!isCanonicalTenantId(tenantId)) throw new Error('RETENTION_TENANT_INVALID');
  return tenantId;
}

function candidateFromRow(row: Record<string, unknown>): RetentionCandidate {
  const source = String(row.source);
  const base = {
    source,
    sourceIdentity: String(row.source_identity),
    ...(row.tenant_id == null ? {} : { tenantId: String(row.tenant_id) }),
    agedAt: String(row.aged_at),
    retentionClass: row.retention_class as RetentionClass,
    disposition: row.disposition as RetentionDisposition,
  };
  if (source === 'provider_effect_ledger') {
    return {
      ...base,
      target: {
        kind: 'provider-effect-ledger',
        provider: String(row.provider),
        idempotencyKey: String(row.idempotency_key),
      },
    };
  }
  return { ...base, target: { kind: 'record', id: String(row.target_id) } };
}

async function applyCandidate(tx: StoreTransaction, candidate: RetentionCandidate) {
  if (candidate.target.kind !== 'record') return;
  switch (candidate.source) {
    case 'evidence_items':
    case 'dead_letter_events':
      await tx.execute({
        sql: `DELETE FROM ${candidate.source} WHERE id = ?`,
        args: [candidate.target.id],
      });
      return;
    case 'workflow_runs.trace':
      await tx.execute({
        sql: 'UPDATE workflow_runs SET trace_context_json = NULL WHERE id = ?',
        args: [candidate.target.id],
      });
      return;
    case 'provider_deliveries.projection':
      await tx.execute({
        sql: 'UPDATE provider_deliveries SET projection_json = NULL WHERE id = ?',
        args: [candidate.target.id],
      });
      return;
    default:
      return;
  }
}
