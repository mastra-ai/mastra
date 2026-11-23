import type { Clock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../domain/id-generator.js';
import { insertTimelineAndOutbox } from '../db/incident-operations.js';
import type { OperationalStore, StoreTransaction } from '../db/operational-store.js';
import type { Evidence } from '../schemas/evidence.js';
import { canonicalJson } from './canonicalize.js';
import type { EvidenceFact, EvidenceSourceV1, InvestigationContext } from './contracts.js';
import { createEvidenceEnvelope } from './hashes.js';
import { evidenceFromEnvelope, evidenceToEnvelope, parseAndVerifyEvidenceRow } from './records.js';

export type PersistEvidenceInput = Readonly<{
  context: InvestigationContext;
  source: EvidenceSourceV1;
  provider: string;
  facts: readonly EvidenceFact[];
}>;

export async function persistEvidenceItems(
  store: OperationalStore,
  input: PersistEvidenceInput,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<readonly Evidence[]> {
  const ids = dependencies.ids ?? uuidGenerator;
  const collectedAt = dependencies.clock
    ? dependencies.clock.now()
    : await readStableCollectionTime(store, input.context);
  const envelopes = input.facts.map(fact =>
    createEvidenceEnvelope({
      tenantId: input.context.tenantId,
      incidentId: input.context.incidentId,
      workflowRunId: input.context.workflowRunId,
      subjectId: input.context.subjectId,
      source: input.source,
      provider: fact.provider ?? input.provider,
      collectedAt,
      fact,
    }),
  );
  try {
    return await store.transaction(async tx => {
      await assertCurrentContext(tx, input.context);
      const persisted: Evidence[] = [];
      for (const envelope of envelopes) {
        const existing = await readEvidenceRow(tx, envelope.evidenceId);
        if (existing) {
          persisted.push(parseAndVerifyEvidenceRow(existing, input.context));
          if (canonicalJson(evidenceToEnvelope(persisted.at(-1)!, input.context)) !== canonicalJson(envelope)) {
            throw new DomainError('CONFLICT');
          }
          continue;
        }
        const evidence = evidenceFromEnvelope(envelope);
        await tx.execute({
          sql: `INSERT INTO evidence_items(
          id, incident_id, tenant_id, source, provider, observed_at, collected_at,
          fact_json, confidence, raw_payload_ref, integrity_hash, sensitivity,
          incomplete, error_code, hash_version, workflow_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            evidence.evidenceId,
            evidence.incidentId,
            evidence.tenantId,
            evidence.source,
            evidence.provider,
            evidence.observedAt,
            evidence.collectedAt,
            canonicalJson(evidence.fact),
            evidence.confidence,
            evidence.rawPayloadRef,
            evidence.integrityHash,
            evidence.sensitivity,
            evidence.incomplete ? 1 : 0,
            evidence.error ?? null,
            evidence.hashVersion,
            input.context.workflowRunId,
          ],
        });
        const updated = await tx.execute({
          sql: `UPDATE incidents
          SET timeline_sequence = timeline_sequence + 1, updated_at = ?
          WHERE tenant_id = ? AND id = ? AND current_run_id = ?
          RETURNING timeline_sequence`,
          args: [collectedAt, input.context.tenantId, input.context.incidentId, input.context.workflowRunId],
        });
        const sequence = Number(updated.rows[0]?.timeline_sequence);
        if (!Number.isInteger(sequence)) throw new DomainError('CONFLICT');
        await insertTimelineAndOutbox(tx, {
          timelineId: ids.next(),
          eventId: ids.next(),
          incidentId: input.context.incidentId,
          tenantId: input.context.tenantId,
          sequence,
          type: 'evidence.persisted',
          eventType: 'security.workflow.updated',
          runId: input.context.workflowRunId,
          correlationId: input.context.correlationId,
          causationId: input.context.eventId,
          occurredAt: collectedAt,
          payload: {
            evidenceId: evidence.evidenceId,
            source: input.source,
            provider: envelope.provider,
            hashVersion: 1,
          },
        });
        persisted.push(evidence);
      }
      return persisted;
    });
  } catch (error) {
    if (!(error instanceof DomainError) || error.code !== 'CONFLICT') throw error;
    const persisted = await readVerifiedEvidence(
      store,
      input.context,
      envelopes.map(envelope => envelope.evidenceId),
    );
    for (const [index, evidence] of persisted.entries()) {
      if (canonicalJson(evidenceToEnvelope(evidence, input.context)) !== canonicalJson(envelopes[index])) {
        throw new DomainError('CONFLICT');
      }
    }
    return persisted;
  }
}

export async function readVerifiedEvidence(
  store: OperationalStore,
  context: InvestigationContext,
  evidenceIds: readonly string[],
): Promise<readonly Evidence[]> {
  const seen = new Set<string>();
  const evidence: Evidence[] = [];
  for (const evidenceId of evidenceIds) {
    if (seen.has(evidenceId)) throw new DomainError('CONFLICT');
    seen.add(evidenceId);
    const result = await store.execute({
      sql: `SELECT * FROM evidence_items
        WHERE tenant_id = ? AND incident_id = ? AND id = ?`,
      args: [context.tenantId, context.incidentId, evidenceId],
    });
    const row = result.rows[0];
    if (!row) throw new DomainError('NOT_FOUND');
    evidence.push(parseAndVerifyEvidenceRow(row, context));
  }
  return evidence;
}

async function assertCurrentContext(tx: StoreTransaction, context: InvestigationContext): Promise<void> {
  const result = await tx.execute({
    sql: `SELECT i.subject_id, i.kind, i.current_run_id, a.id AS alert_id
      FROM incidents i
      JOIN alerts a ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
      WHERE i.tenant_id = ? AND i.id = ? AND a.id = ?`,
    args: [context.tenantId, context.incidentId, context.alertId],
  });
  const row = result.rows[0];
  if (!row) throw new DomainError('NOT_FOUND');
  if (
    row.subject_id !== context.subjectId ||
    row.kind !== context.incidentKind ||
    row.current_run_id !== context.workflowRunId
  ) {
    throw new DomainError('CONFLICT');
  }
}

async function readStableCollectionTime(store: OperationalStore, context: InvestigationContext): Promise<string> {
  const result = await store.execute({
    sql: `SELECT started_at FROM workflow_runs
      WHERE tenant_id = ? AND incident_id = ? AND run_id = ?`,
    args: [context.tenantId, context.incidentId, context.workflowRunId],
  });
  const startedAt = result.rows[0]?.started_at;
  if (typeof startedAt !== 'string') throw new DomainError('NOT_FOUND');
  return startedAt;
}

async function readEvidenceRow(tx: StoreTransaction, evidenceId: string) {
  const result = await tx.execute({
    sql: 'SELECT * FROM evidence_items WHERE id = ?',
    args: [evidenceId],
  });
  return result.rows[0];
}
