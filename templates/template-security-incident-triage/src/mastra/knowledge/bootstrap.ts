import { resolveRunbookRoot } from './root.js';

import { resolveEligibleGeneration } from '../../db/runbook-operations.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { IncidentKindSchema } from '../../schemas/incident.js';
import { FastEmbedRunbookEmbedder, type RunbookEmbedder } from './embeddings.js';
import { sha256 } from './hashes.js';
import { indexRunbook } from './indexer.js';
import { loadRunbooks } from './loader.js';
import { LibSqlRunbookVectorStore, type RunbookVectorStore } from './vector-store.js';

export type RunbookKnowledgeBootstrapOptions = Readonly<{
  root?: string;
  createEmbedder?: () => RunbookEmbedder;
  createVectorStore?: () => RunbookVectorStore;
  now?: () => Date;
}>;

/**
 * Makes the checked-in knowledge base available before alert workers start.
 * Unchanged active generations return without loading the embedding model.
 */
export async function bootstrapRunbookKnowledge(
  store: OperationalStore,
  options: RunbookKnowledgeBootstrapOptions = {},
): Promise<Readonly<{ indexed: number; unchanged: number }>> {
  const root = options.root ?? resolveRunbookRoot();
  const runbooks = (await loadRunbooks(root)).filter(runbook => runbook.metadata.status === 'active');
  const activeKinds = new Set(runbooks.flatMap(runbook => runbook.metadata.incidentKinds));
  if (IncidentKindSchema.options.some(kind => !activeKinds.has(kind))) {
    throw new Error('Runbook knowledge does not cover every incident kind.');
  }
  let indexed = 0;
  let unchanged = 0;
  let vectorStore: RunbookVectorStore | undefined;
  let embedder: RunbookEmbedder | undefined;

  try {
    for (const runbook of runbooks) {
      const kind = runbook.metadata.incidentKinds[0];
      if (!kind) continue;
      const current = await resolveEligibleGeneration(store, kind);
      if (
        current?.runbookId === runbook.metadata.id &&
        current.version === runbook.metadata.version &&
        current.sourceHash === runbook.sourceHash
      ) {
        unchanged += 1;
        continue;
      }

      vectorStore ??= options.createVectorStore?.() ?? new LibSqlRunbookVectorStore();
      embedder ??= options.createEmbedder?.() ?? new FastEmbedRunbookEmbedder();
      const generationId = generationIdFor(runbook);
      await indexRunbook(store, vectorStore, embedder, runbook, {
        generationId,
        now: (options.now?.() ?? new Date()).toISOString(),
      });
      indexed += 1;
    }
  } finally {
    await vectorStore?.close();
  }

  return Object.freeze({ indexed, unchanged });
}

function generationIdFor(
  runbook: Readonly<{
    metadata: Readonly<{ id: string; version: string }>;
    sourceHash: string;
  }>,
): string {
  return `gen_${sha256(`${runbook.metadata.id}\0${runbook.metadata.version}\0${runbook.sourceHash}`).slice(0, 32)}`;
}
