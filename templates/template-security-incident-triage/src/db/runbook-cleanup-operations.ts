import { DomainError } from '../domain/errors.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';
import type { CleanupGenerationInput } from './runbook-generation-types.js';

export async function claimRunbookGenerationCleanup(
  store: OperationalStore,
  input: CleanupGenerationInput,
  claimedAt: string,
  dryRun: boolean,
): Promise<'claimed' | 'deleted' | 'validated'> {
  return store.transaction(async tx => {
    await assertCleanupEligible(tx, input, claimedAt);
    const existing = await tx.execute({
      sql: `SELECT index_name, expected_chunk_count, status
        FROM runbook_generation_cleanup_claims WHERE generation_id = ?`,
      args: [input.generationId],
    });
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.index_name !== input.indexName || Number(row.expected_chunk_count) !== input.expectedChunkCount) {
        throw new DomainError('CONFLICT');
      }
      return row.status === 'deleted' ? 'deleted' : 'claimed';
    }
    if (dryRun) return 'validated';
    await tx.execute({
      sql: `INSERT INTO runbook_generation_cleanup_claims(
        generation_id, index_name, expected_chunk_count, status, claimed_at
      ) VALUES (?, ?, ?, 'claimed', ?)`,
      args: [input.generationId, input.indexName, input.expectedChunkCount, claimedAt],
    });
    return 'claimed';
  });
}

export async function revalidateRunbookGenerationCleanup(
  store: OperationalStore,
  input: CleanupGenerationInput,
  checkedAt: string,
): Promise<void> {
  await store.transaction(async tx => {
    await assertCleanupEligible(tx, input, checkedAt);
    const claim = await tx.execute({
      sql: `SELECT index_name, expected_chunk_count, status
        FROM runbook_generation_cleanup_claims WHERE generation_id = ?`,
      args: [input.generationId],
    });
    const row = claim.rows[0];
    if (
      !row ||
      row.status !== 'claimed' ||
      row.index_name !== input.indexName ||
      Number(row.expected_chunk_count) !== input.expectedChunkCount
    ) {
      throw new DomainError('CONFLICT');
    }
  });
}

export async function completeRunbookGenerationCleanup(
  store: OperationalStore,
  input: CleanupGenerationInput,
  completedAt: string,
): Promise<void> {
  await store.transaction(async tx => {
    const updated = await tx.execute({
      sql: `UPDATE runbook_generation_cleanup_claims
        SET status = 'deleted', completed_at = ?
        WHERE generation_id = ? AND index_name = ? AND expected_chunk_count = ?
          AND status = 'claimed'`,
      args: [completedAt, input.generationId, input.indexName, input.expectedChunkCount],
    });
    if (updated.rowsAffected !== 1) throw new DomainError('CONFLICT');
  });
}

async function assertCleanupEligible(
  tx: StoreTransaction,
  input: CleanupGenerationInput,
  checkedAt: string,
): Promise<void> {
  const result = await tx.execute({
    sql: `SELECT g.index_name, g.state, g.chunk_count,
      EXISTS(SELECT 1 FROM runbook_activations a
        WHERE a.generation_id = g.generation_id) AS is_active,
      EXISTS(SELECT 1 FROM runbook_retrievals r
        WHERE r.generation_id = g.generation_id
          AND r.status = 'in_progress' AND r.lease_expires_at > ?) AS has_in_progress
      FROM runbook_generations g WHERE g.generation_id = ?`,
    args: [checkedAt, input.generationId],
  });
  const row = result.rows[0];
  if (
    !row ||
    row.index_name !== input.indexName ||
    !['failed', 'retired'].includes(String(row.state)) ||
    Number(row.chunk_count) !== input.expectedChunkCount ||
    Number(row.is_active) !== 0 ||
    Number(row.has_in_progress) !== 0
  ) {
    throw new DomainError('CONFLICT');
  }
}
