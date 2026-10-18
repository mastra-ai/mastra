import type { AuthoritativeChunk, PersistedRetrievalChunk } from '../../db/runbook-retrieval-operations.js';
import type { EligibleGeneration } from '../../db/runbook-operations.js';
import { RunbookError } from './errors.js';
import { canonicalJson, sha256 } from './hashes.js';
import { EMBEDDING_DIMENSION, RunbookChunkMetadataSchema, type RunbookChunkMetadata } from './schemas.js';
import type { RunbookVectorStore } from './vector-store.js';

export async function queryAndRankEligibleChunks(
  vectorStore: RunbookVectorStore,
  generation: EligibleGeneration,
  authoritative: ReadonlyMap<string, AuthoritativeChunk>,
  queryVector: readonly number[],
  threshold: number,
  topK: number,
): Promise<readonly PersistedRetrievalChunk[]> {
  const stats = await vectorStore.describe(generation.indexName);
  if (
    stats.dimension !== EMBEDDING_DIMENSION ||
    stats.count !== generation.chunkCount ||
    authoritative.size !== generation.chunkCount
  ) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  const matches = await vectorStore.query(generation.indexName, queryVector, generation.chunkCount);
  if (matches.length !== generation.chunkCount) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }

  const selected: PersistedRetrievalChunk[] = [];
  const matchedIds = new Set<string>();
  for (const match of matches) {
    if (!Number.isFinite(match.score) || match.score < -1 || match.score > 1 || matchedIds.has(match.id)) {
      throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
    }
    matchedIds.add(match.id);
    const chunk = authoritative.get(match.id);
    const metadata = RunbookChunkMetadataSchema.safeParse(match.metadata);
    if (
      !chunk ||
      !metadata.success ||
      metadata.data.generationId !== generation.generationId ||
      metadata.data.indexName !== generation.indexName ||
      metadata.data.incidentKind !== generation.incidentKind ||
      metadata.data.runbookId !== generation.runbookId ||
      metadata.data.runbookVersion !== generation.version ||
      metadata.data.sourceHash !== generation.sourceHash ||
      metadata.data.status !== 'active' ||
      metadata.data.text !== chunk.text ||
      metadata.data.contentHash !== chunk.contentHash ||
      metadata.data.metadataHash !== chunk.metadataHash ||
      recomputeMetadataHash(metadata.data) !== metadata.data.metadataHash
    ) {
      throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
    }
    if (match.score >= threshold) {
      selected.push({ ...chunk, score: match.score, rank: 0 });
    }
  }
  if (matchedIds.size !== authoritative.size || [...authoritative.keys()].some(chunkId => !matchedIds.has(chunkId))) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }

  selected.sort(
    (left, right) =>
      right.score - left.score ||
      left.metadata.sectionOrdinal - right.metadata.sectionOrdinal ||
      left.metadata.chunkOrdinal - right.metadata.chunkOrdinal ||
      left.metadata.chunkId.localeCompare(right.metadata.chunkId),
  );
  return selected.slice(0, topK).map((chunk, index) => ({ ...chunk, rank: index + 1 }));
}

function recomputeMetadataHash(metadata: RunbookChunkMetadata): string {
  const unsigned: Partial<RunbookChunkMetadata> = { ...metadata };
  delete unsigned.metadataHash;
  return sha256(canonicalJson(unsigned));
}
