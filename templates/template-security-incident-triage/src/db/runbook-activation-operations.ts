import { DomainError } from '../domain/errors.js';
import type { IncidentKind } from '../schemas/incident.js';
import type { OperationalStore } from './operational-store.js';
import type { EligibleGeneration } from './runbook-generation-types.js';

export async function activateRunbookGeneration(
  store: OperationalStore,
  input: Readonly<{
    generationId: string;
    expectedRevision: number;
    activatedAt: string;
  }>,
): Promise<number> {
  return store.transaction(async tx => {
    const targetResult = await tx.execute({
      sql: `SELECT generation_id, runbook_id, version, incident_kind, state, chunk_count,
        EXISTS(SELECT 1 FROM runbook_generation_cleanup_claims c
          WHERE c.generation_id = runbook_generations.generation_id) AS cleanup_claimed
        FROM runbook_generations WHERE generation_id = ?`,
      args: [input.generationId],
    });
    const target = targetResult.rows[0];
    if (!target || !['staged', 'active'].includes(String(target.state)) || Number(target.cleanup_claimed) !== 0) {
      throw new DomainError('CONFLICT');
    }
    const indexed = await tx.execute({
      sql: `SELECT count(*) AS count FROM runbook_chunks
        WHERE generation_id = ? AND indexed_at IS NOT NULL`,
      args: [input.generationId],
    });
    if (Number(indexed.rows[0]?.count) !== Number(target.chunk_count)) {
      throw new DomainError('CONFLICT');
    }
    const current = await tx.execute({
      sql: `SELECT generation_id, revision FROM runbook_activations WHERE incident_kind = ?`,
      args: [target.incident_kind as string],
    });
    const currentRow = current.rows[0];
    if (!currentRow) {
      if (input.expectedRevision !== 0) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `INSERT INTO runbook_activations(
          incident_kind, runbook_id, version, generation_id, revision, activated_at
        ) VALUES (?, ?, ?, ?, 1, ?)`,
        args: [
          target.incident_kind as string,
          target.runbook_id as string,
          target.version as string,
          input.generationId,
          input.activatedAt,
        ],
      });
      await tx.execute({
        sql: `INSERT INTO runbook_activation_events(
          incident_kind, resulting_revision, operation, from_generation_id,
          to_generation_id, expected_revision, occurred_at
        ) VALUES (?, 1, 'activate', NULL, ?, 0, ?)`,
        args: [target.incident_kind as string, input.generationId, input.activatedAt],
      });
    } else {
      if (currentRow.generation_id === input.generationId) {
        return Number(currentRow.revision);
      }
      if (Number(currentRow.revision) !== input.expectedRevision) throw new DomainError('CONFLICT');
      const updated = await tx.execute({
        sql: `UPDATE runbook_activations SET runbook_id = ?, version = ?,
          generation_id = ?, revision = revision + 1, activated_at = ?
          WHERE incident_kind = ? AND revision = ?`,
        args: [
          target.runbook_id as string,
          target.version as string,
          input.generationId,
          input.activatedAt,
          target.incident_kind as string,
          input.expectedRevision,
        ],
      });
      if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `UPDATE runbook_generations SET state = 'retired', retired_at = ?
          WHERE generation_id = ? AND state = 'active'`,
        args: [input.activatedAt, currentRow.generation_id as string],
      });
      await tx.execute({
        sql: `INSERT INTO runbook_activation_events(
          incident_kind, resulting_revision, operation, from_generation_id,
          to_generation_id, expected_revision, occurred_at
        ) VALUES (?, ?, 'activate', ?, ?, ?, ?)`,
        args: [
          target.incident_kind as string,
          input.expectedRevision + 1,
          currentRow.generation_id as string,
          input.generationId,
          input.expectedRevision,
          input.activatedAt,
        ],
      });
    }
    await tx.execute({
      sql: `UPDATE runbook_generations SET state = 'active', activated_at = ?,
        retired_at = NULL, error_code = NULL WHERE generation_id = ?`,
      args: [input.activatedAt, input.generationId],
    });
    return input.expectedRevision + 1;
  });
}

export async function resolveRollbackGeneration(
  store: OperationalStore,
  generationId: string,
): Promise<EligibleGeneration> {
  const result = await store.execute({
    sql: `SELECT g.incident_kind, g.runbook_id, g.version, g.generation_id,
      g.index_name, g.chunk_count, g.aggregate_hash, g.state,
      v.allowed_actions_json, v.mandatory_rules_json, v.source_hash, v.declared_status,
      a.revision,
      EXISTS(SELECT 1 FROM runbook_activation_events e
        WHERE e.incident_kind = g.incident_kind
          AND e.to_generation_id = g.generation_id) AS was_active
      FROM runbook_generations g
      JOIN runbook_versions v ON v.runbook_id = g.runbook_id AND v.version = g.version
      JOIN runbook_activations a ON a.incident_kind = g.incident_kind
      WHERE g.generation_id = ?`,
    args: [generationId],
  });
  const row = result.rows[0];
  if (!row || row.state !== 'retired' || row.declared_status !== 'active' || Number(row.was_active) !== 1) {
    throw new DomainError('CONFLICT');
  }
  return {
    incidentKind: row.incident_kind as IncidentKind,
    runbookId: String(row.runbook_id),
    version: String(row.version),
    generationId: String(row.generation_id),
    indexName: String(row.index_name),
    revision: Number(row.revision),
    chunkCount: Number(row.chunk_count),
    aggregateHash: String(row.aggregate_hash),
    allowedActionsJson: String(row.allowed_actions_json),
    mandatoryRulesJson: String(row.mandatory_rules_json),
    sourceHash: String(row.source_hash),
  };
}

export async function rollbackRunbookGenerationCas(
  store: OperationalStore,
  input: Readonly<{
    generationId: string;
    expectedRevision: number;
    rolledBackAt: string;
  }>,
): Promise<number> {
  return store.transaction(async tx => {
    const targetResult = await tx.execute({
      sql: `SELECT g.runbook_id, g.version, g.incident_kind, g.state, g.chunk_count,
        (SELECT count(*) FROM runbook_chunks c WHERE c.generation_id = g.generation_id
          AND c.indexed_at IS NOT NULL) AS indexed_count,
        EXISTS(SELECT 1 FROM runbook_activation_events e
          WHERE e.incident_kind = g.incident_kind
            AND e.to_generation_id = g.generation_id) AS was_active,
        EXISTS(SELECT 1 FROM runbook_generation_cleanup_claims c
          WHERE c.generation_id = g.generation_id) AS cleanup_claimed
        FROM runbook_generations g WHERE g.generation_id = ?`,
      args: [input.generationId],
    });
    const target = targetResult.rows[0];
    if (
      !target ||
      target.state !== 'retired' ||
      Number(target.indexed_count) !== Number(target.chunk_count) ||
      Number(target.was_active) !== 1 ||
      Number(target.cleanup_claimed) !== 0
    ) {
      throw new DomainError('CONFLICT');
    }
    const currentResult = await tx.execute({
      sql: `SELECT generation_id, revision FROM runbook_activations
        WHERE incident_kind = ?`,
      args: [target.incident_kind as string],
    });
    const current = currentResult.rows[0];
    if (
      !current ||
      current.generation_id === input.generationId ||
      Number(current.revision) !== input.expectedRevision
    ) {
      throw new DomainError('CONFLICT');
    }
    const revision = input.expectedRevision + 1;
    const updated = await tx.execute({
      sql: `UPDATE runbook_activations SET runbook_id = ?, version = ?,
        generation_id = ?, revision = ?, activated_at = ?
        WHERE incident_kind = ? AND revision = ? AND generation_id = ?`,
      args: [
        target.runbook_id as string,
        target.version as string,
        input.generationId,
        revision,
        input.rolledBackAt,
        target.incident_kind as string,
        input.expectedRevision,
        current.generation_id as string,
      ],
    });
    if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
    await tx.execute({
      sql: `UPDATE runbook_generations SET state = 'retired', retired_at = ?
        WHERE generation_id = ? AND state = 'active'`,
      args: [input.rolledBackAt, current.generation_id as string],
    });
    const activated = await tx.execute({
      sql: `UPDATE runbook_generations SET state = 'active', activated_at = ?,
        retired_at = NULL, error_code = NULL
        WHERE generation_id = ? AND state = 'retired'`,
      args: [input.rolledBackAt, input.generationId],
    });
    if (activated.rowsAffected !== 1) throw new DomainError('CONFLICT');
    await tx.execute({
      sql: `INSERT INTO runbook_activation_events(
        incident_kind, resulting_revision, operation, from_generation_id,
        to_generation_id, expected_revision, occurred_at
      ) VALUES (?, ?, 'rollback', ?, ?, ?, ?)`,
      args: [
        target.incident_kind as string,
        revision,
        current.generation_id as string,
        input.generationId,
        input.expectedRevision,
        input.rolledBackAt,
      ],
    });
    return revision;
  });
}
