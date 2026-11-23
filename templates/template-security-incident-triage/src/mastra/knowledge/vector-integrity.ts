import { canonicalJson, sha256 } from './hashes.js';
import { RunbookError } from './errors.js';
import { EMBEDDING_DIMENSION, RunbookChunkMetadataSchema, type RunbookChunkMetadata } from './schemas.js';
import type { RunbookVectorStore } from './vector-store.js';

export type VerifiableChunk = Readonly<{
  metadata: RunbookChunkMetadata;
  text: string;
}>;

export async function verifyVectorReadback(
  vectorStore: RunbookVectorStore,
  indexName: string,
  probe: readonly number[],
  chunks: readonly VerifiableChunk[],
): Promise<void> {
  const stats = await vectorStore.describe(indexName);
  if (stats.dimension !== EMBEDDING_DIMENSION || stats.count !== chunks.length) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  const readback = await vectorStore.query(indexName, probe, chunks.length);
  const expected = new Map(chunks.map(chunk => [chunk.metadata.chunkId, chunk] as const));
  if (readback.length !== chunks.length) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  for (const match of readback) {
    const chunk = expected.get(match.id);
    const metadata = RunbookChunkMetadataSchema.safeParse(match.metadata);
    if (!chunk || !metadata.success) {
      throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
    }
    const unsigned: Partial<RunbookChunkMetadata> = { ...metadata.data };
    delete unsigned.metadataHash;
    if (
      metadata.data.chunkId !== match.id ||
      canonicalJson(metadata.data) !== canonicalJson(chunk.metadata) ||
      metadata.data.text !== chunk.text ||
      metadata.data.contentHash !== chunk.metadata.contentHash ||
      metadata.data.metadataHash !== chunk.metadata.metadataHash ||
      sha256(metadata.data.text) !== metadata.data.contentHash ||
      sha256(canonicalJson(unsigned)) !== metadata.data.metadataHash
    ) {
      throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
    }
    expected.delete(match.id);
  }
  if (expected.size !== 0) {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
}
