import { DomainError } from '../domain/errors.js';
import { sha256 } from '../mastra/knowledge/hashes.js';
import { RunbookChunkMetadataSchema } from '../mastra/knowledge/schemas.js';
import type { OperationalStore } from './operational-store.js';
import {
  recomputeMetadataHash,
  selectionQuery,
  successfulIntegrityHash,
  validateSelectionRow,
} from './runbook-retrieval-integrity.js';
import type { AuthoritativeChunk, RetrievalScope } from './runbook-retrieval-types.js';

export async function listAuthoritativeChunks(
  store: OperationalStore,
  generationId: string,
): Promise<ReadonlyMap<string, AuthoritativeChunk>> {
  const result = await store.execute({
    sql: `SELECT chunk_id, text, content_hash, metadata_hash, metadata_json
      FROM runbook_chunks WHERE generation_id = ? AND indexed_at IS NOT NULL`,
    args: [generationId],
  });
  const chunks = new Map<string, AuthoritativeChunk>();
  for (const row of result.rows) {
    if (typeof row.metadata_json !== 'string' || typeof row.text !== 'string') {
      throw new DomainError('VALIDATION_FAILED');
    }
    let metadataValue: unknown;
    try {
      metadataValue = JSON.parse(row.metadata_json);
    } catch {
      throw new DomainError('VALIDATION_FAILED');
    }
    const metadata = RunbookChunkMetadataSchema.safeParse(metadataValue);
    if (
      !metadata.success ||
      metadata.data.chunkId !== row.chunk_id ||
      metadata.data.text !== row.text ||
      metadata.data.contentHash !== row.content_hash ||
      metadata.data.metadataHash !== row.metadata_hash ||
      sha256(row.text) !== row.content_hash ||
      recomputeMetadataHash(metadata.data) !== row.metadata_hash
    )
      throw new DomainError('VALIDATION_FAILED');
    chunks.set(metadata.data.chunkId, {
      metadata: metadata.data,
      text: row.text,
      contentHash: String(row.content_hash),
      metadataHash: String(row.metadata_hash),
    });
  }
  return chunks;
}

export async function findSuccessfulRetrieval(
  store: OperationalStore,
  input: RetrievalScope,
): Promise<
  | Readonly<{
      retrievalId: string;
      runbookId: string;
      version: string;
      generationId: string;
      citation: string;
      chunkIds: readonly string[];
    }>
  | undefined
> {
  const result = await store.execute({
    sql: `${selectionQuery}
      WHERE r.tenant_id = ? AND r.incident_id = ? AND r.workflow_run_id = ?
        AND r.query_hash = ? AND r.policy_version = 1 AND r.status = 'succeeded'`,
    args: [input.tenantId, input.incidentId, input.workflowRunId, input.queryHash],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  const selection = validateSelectionRow(row, input);
  const chunks = await store.execute({
    sql: `SELECT rc.rank, rc.generation_id, rc.chunk_id, rc.vector_id,
      rc.content_hash, rc.metadata_hash, rc.score_text, rc.score,
      rc.section_ordinal, rc.chunk_ordinal,
      c.content_hash AS current_content_hash,
      c.metadata_hash AS current_metadata_hash
      FROM runbook_retrieval_chunks rc
      JOIN runbook_chunks c ON c.generation_id = rc.generation_id
        AND c.chunk_id = rc.chunk_id AND c.vector_id = rc.vector_id
      WHERE rc.retrieval_id = ? ORDER BY rc.rank`,
    args: [selection.retrievalId],
  });
  if (chunks.rows.length === 0) throw new DomainError('VALIDATION_FAILED');
  const integrityChunks = chunks.rows.map((chunk, index) => {
    const score = Number(chunk.score);
    if (
      Number(chunk.rank) !== index + 1 ||
      chunk.generation_id !== selection.generation.generationId ||
      !Number.isFinite(score) ||
      typeof chunk.score_text !== 'string' ||
      Number(chunk.score_text) !== score ||
      chunk.content_hash !== chunk.current_content_hash ||
      chunk.metadata_hash !== chunk.current_metadata_hash
    )
      throw new DomainError('VALIDATION_FAILED');
    return {
      id: String(chunk.chunk_id),
      vectorId: String(chunk.vector_id),
      rank: Number(chunk.rank),
      score: chunk.score_text,
      contentHash: String(chunk.content_hash),
      metadataHash: String(chunk.metadata_hash),
      sectionOrdinal: Number(chunk.section_ordinal),
      chunkOrdinal: Number(chunk.chunk_ordinal),
    };
  });
  const aggregate = successfulIntegrityHash(selection, input, integrityChunks);
  if (aggregate !== row.aggregate_integrity_hash) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return {
    retrievalId: selection.retrievalId,
    runbookId: selection.generation.runbookId,
    version: selection.generation.version,
    generationId: selection.generation.generationId,
    citation: selection.citation,
    chunkIds: integrityChunks.map(chunk => chunk.id),
  };
}
