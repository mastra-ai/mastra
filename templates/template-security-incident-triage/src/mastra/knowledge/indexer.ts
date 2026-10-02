import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError } from '../../domain/errors.js';
import {
  activateRunbookGeneration,
  getActivationRevision,
  markRunbookChunksIndexed,
  markRunbookGenerationFailed,
  resolveEligibleGeneration,
  stageRunbookGeneration,
} from '../../db/runbook-operations.js';
import { aggregateChunks, chunkRunbook } from './chunker.js';
import { RunbookError } from './errors.js';
import { sha256 } from './hashes.js';
import type { LoadedRunbook } from './loader.js';
import { EMBEDDING_DIMENSION } from './schemas.js';
import type { RunbookEmbedder } from './embeddings.js';
import type { RunbookVectorStore } from './vector-store.js';
import { verifyVectorReadback } from './vector-integrity.js';

export { cleanupRunbookGeneration, rollbackRunbookGeneration } from './runbook-lifecycle.js';

export async function indexRunbook(
  store: OperationalStore,
  vectorStore: RunbookVectorStore,
  embedder: RunbookEmbedder,
  runbook: LoadedRunbook,
  input: Readonly<{ generationId: string; now: string }>,
): Promise<
  Readonly<{
    generationId: string;
    indexName: string;
    revision: number;
    chunkCount: number;
  }>
> {
  const kind = runbook.metadata.incidentKinds[0];
  if (!kind) throw new RunbookError('RUNBOOK_VALIDATION_FAILED');
  if (runbook.metadata.status !== 'active') throw new RunbookError('RUNBOOK_INELIGIBLE');
  const indexName = physicalIndexName(kind, runbook.metadata.version, input.generationId);
  const chunks = await chunkRunbook(runbook, {
    generationId: input.generationId,
    indexName,
  });
  const aggregateHash = aggregateChunks(chunks);
  const expectedRevision = await getActivationRevision(store, kind);
  const stage = await stageRunbookGeneration(store, {
    runbook,
    generationId: input.generationId,
    indexName,
    aggregateHash,
    chunks,
    createdAt: input.now,
  });
  if (stage === 'existing') {
    const active = await resolveEligibleGeneration(store, kind);
    if (active?.generationId === input.generationId) {
      return {
        generationId: input.generationId,
        indexName,
        revision: active.revision,
        chunkCount: active.chunkCount,
      };
    }
  }
  try {
    await vectorStore.ensureIndex(indexName, EMBEDDING_DIMENSION);
    const vectors = await embedder.embedDocuments(chunks.map(chunk => chunk.text));
    if (vectors.some(vector => vector.length !== EMBEDDING_DIMENSION)) {
      throw new Error('Embedding dimension mismatch');
    }
    await vectorStore.upsert(
      indexName,
      chunks.map(chunk => chunk.id),
      vectors,
      chunks.map(chunk => chunk.metadata),
    );
    const probe = vectors[0];
    if (!probe) throw new Error('Vector readback probe is unavailable');
    await verifyVectorReadback(vectorStore, indexName, probe, chunks);
    await markRunbookChunksIndexed(store, input.generationId, input.now);
    const revision = await activateRunbookGeneration(store, {
      generationId: input.generationId,
      expectedRevision,
      activatedAt: input.now,
    });
    return {
      generationId: input.generationId,
      indexName,
      revision,
      chunkCount: chunks.length,
    };
  } catch (error) {
    const errorCode =
      error instanceof RunbookError && error.code === 'RUNBOOK_INTEGRITY_FAILED'
        ? 'RUNBOOK_INTEGRITY_FAILED'
        : error instanceof DomainError && error.code === 'CONFLICT'
          ? 'RUNBOOK_INELIGIBLE'
          : 'RUNBOOK_BACKEND_UNAVAILABLE';
    await markRunbookGenerationFailed(store, input.generationId, errorCode);
    if (stage === 'created') {
      try {
        await vectorStore.deleteIndex(indexName);
      } catch {
        // The failed generation remains ineligible and records the safe failure.
      }
    }
    if (error instanceof RunbookError) throw error;
    throw new RunbookError(errorCode, errorCode === 'RUNBOOK_BACKEND_UNAVAILABLE');
  }
}

export function physicalIndexName(kind: string, version: string, generationId: string): string {
  const safeKind = kind.replaceAll(/[^a-z0-9]+/gu, '_');
  const safeVersion = version.replaceAll('.', '_');
  return `rb_${safeKind}_${safeVersion}_${sha256(generationId).slice(0, 16)}`;
}
