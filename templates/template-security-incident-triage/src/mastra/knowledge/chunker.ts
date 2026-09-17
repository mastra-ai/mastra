import { MDocument } from '@mastra/rag';

import { canonicalJson, sha256 } from './hashes.js';
import type { LoadedRunbook } from './loader.js';
import {
  CHUNKING_ALGORITHM_VERSION,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  RUNBOOK_SCHEMA_VERSION,
  RunbookChunkMetadataSchema,
  type RunbookChunkMetadata,
} from './schemas.js';

export type PreparedChunk = Readonly<{
  id: string;
  text: string;
  metadata: RunbookChunkMetadata;
}>;

export async function chunkRunbook(
  runbook: LoadedRunbook,
  generation: Readonly<{ generationId: string; indexName: string }>,
): Promise<readonly PreparedChunk[]> {
  const kind = runbook.metadata.incidentKinds[0];
  if (!kind) throw new Error('Validated runbook has no incident kind');
  const chunks: PreparedChunk[] = [];
  for (const [sectionIndex, section] of runbook.sections.entries()) {
    const document = MDocument.fromMarkdown(section.body, {
      sectionKey: section.key,
    });
    const sectionChunks = await document.chunk({
      strategy: 'recursive',
      maxSize: 900,
      overlap: 100,
      separators: ['\n\n', '\n', '. ', ' '],
      stripWhitespace: true,
      separatorPosition: 'end',
    });
    for (const [chunkOrdinal, item] of sectionChunks.entries()) {
      const text = `## ${section.heading}\n\n${item.text.trim()}`;
      const contentHash = sha256(text);
      const id = `rch_${sha256(
        [
          'runbook-chunk-v1',
          runbook.metadata.id,
          runbook.metadata.version,
          kind,
          section.key,
          String(chunkOrdinal),
          contentHash,
        ].join('\0'),
      )}`;
      const unsigned = {
        schemaVersion: RUNBOOK_SCHEMA_VERSION,
        chunkingAlgorithmVersion: CHUNKING_ALGORITHM_VERSION,
        chunkId: id,
        vectorId: id,
        runbookId: runbook.metadata.id,
        runbookVersion: runbook.metadata.version,
        incidentKind: kind,
        status: runbook.metadata.status,
        owner: runbook.metadata.owner,
        sourcePath: runbook.sourcePath,
        sectionKey: section.key,
        sectionOrdinal: sectionIndex + 1,
        chunkOrdinal,
        sourceHash: runbook.sourceHash,
        contentHash,
        generationId: generation.generationId,
        indexName: generation.indexName,
        embeddingProvider: EMBEDDING_PROVIDER,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimension: EMBEDDING_DIMENSION,
        text,
      } as const;
      const metadata = RunbookChunkMetadataSchema.parse({
        ...unsigned,
        metadataHash: sha256(canonicalJson(unsigned)),
      });
      chunks.push(Object.freeze({ id, text, metadata }));
    }
  }
  return Object.freeze(chunks);
}

export function aggregateChunks(chunks: readonly PreparedChunk[]): string {
  return sha256(chunks.map(chunk => `${chunk.id}:${chunk.metadata.metadataHash}`).join('\n'));
}
