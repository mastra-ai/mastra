import type { OperationalStore } from '../../db/operational-store.js';
import {
  claimRunbookGenerationCleanup,
  completeRunbookGenerationCleanup,
  revalidateRunbookGenerationCleanup,
  resolveRollbackGeneration,
  rollbackRunbookGenerationCas,
  type EligibleGeneration,
} from '../../db/runbook-operations.js';
import { listAuthoritativeChunks } from '../../db/runbook-retrieval-operations.js';
import type { RunbookEmbedder } from './embeddings.js';
import { RunbookError } from './errors.js';
import { sha256 } from './hashes.js';
import type { RunbookVectorStore } from './vector-store.js';
import { verifyVectorReadback } from './vector-integrity.js';

export async function cleanupRunbookGeneration(
  store: OperationalStore,
  vectorStore: RunbookVectorStore,
  input: Readonly<{
    generationId: string;
    indexName: string;
    expectedChunkCount: number;
    dryRun: boolean;
    now?: string;
  }>,
): Promise<Readonly<{ eligible: true; deleted: boolean }>> {
  const cleanupInput = {
    generationId: input.generationId,
    indexName: input.indexName,
    expectedChunkCount: input.expectedChunkCount,
  };
  const now = input.now ?? new Date().toISOString();
  let claim;
  try {
    claim = await claimRunbookGenerationCleanup(store, cleanupInput, now, input.dryRun);
  } catch {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
  if (input.dryRun) return { eligible: true, deleted: false };
  if (claim === 'deleted') return { eligible: true, deleted: true };
  try {
    await revalidateRunbookGenerationCleanup(store, cleanupInput, input.now ?? new Date().toISOString());
  } catch {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
  try {
    await vectorStore.deleteIndex(input.indexName);
    await completeRunbookGenerationCleanup(store, cleanupInput, input.now ?? new Date().toISOString());
  } catch {
    throw new RunbookError('RUNBOOK_BACKEND_UNAVAILABLE', true);
  }
  return { eligible: true, deleted: true };
}

export async function rollbackRunbookGeneration(
  store: OperationalStore,
  vectorStore: RunbookVectorStore,
  embedder: RunbookEmbedder,
  input: Readonly<{
    generationId: string;
    expectedRevision: number;
    now: string;
  }>,
): Promise<Readonly<{ generationId: string; revision: number }>> {
  let generation;
  try {
    generation = await resolveRollbackGeneration(store, input.generationId);
  } catch {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
  if (generation.revision !== input.expectedRevision) {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
  await verifyGenerationIndex(store, vectorStore, embedder, generation);
  try {
    const revision = await rollbackRunbookGenerationCas(store, {
      generationId: input.generationId,
      expectedRevision: input.expectedRevision,
      rolledBackAt: input.now,
    });
    return { generationId: input.generationId, revision };
  } catch {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
}

async function verifyGenerationIndex(
  store: OperationalStore,
  vectorStore: RunbookVectorStore,
  embedder: RunbookEmbedder,
  generation: EligibleGeneration,
): Promise<void> {
  let authoritative;
  try {
    authoritative = await listAuthoritativeChunks(store, generation.generationId);
  } catch {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  const ordered = [...authoritative.values()].sort(
    (left, right) =>
      left.metadata.sectionOrdinal - right.metadata.sectionOrdinal ||
      left.metadata.chunkOrdinal - right.metadata.chunkOrdinal,
  );
  const aggregate = sha256(ordered.map(chunk => `${chunk.metadata.chunkId}:${chunk.metadataHash}`).join('\n'));
  if (ordered.length !== generation.chunkCount || aggregate !== generation.aggregateHash) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  try {
    const first = ordered[0];
    if (!first) throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
    const probe = await embedder.embedQuery(first.text);
    await verifyVectorReadback(vectorStore, generation.indexName, probe, ordered);
  } catch (error) {
    if (error instanceof RunbookError) throw error;
    throw new RunbookError('RUNBOOK_BACKEND_UNAVAILABLE', true);
  }
}
