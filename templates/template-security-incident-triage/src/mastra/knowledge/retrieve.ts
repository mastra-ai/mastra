import type { OperationalStore } from '../../db/operational-store.js';
import {
  claimRetrievalSelection,
  findSuccessfulRetrieval,
  listAuthoritativeChunks,
  persistSuccessfulRetrieval,
  type PersistedSelection,
} from '../../db/runbook-retrieval-operations.js';
import { resolveEligibleGeneration } from '../../db/runbook-operations.js';
import { DomainError } from '../../domain/errors.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import type { Clock } from '../../domain/clock.js';
import { validatePersistedAllowedActions } from './allowlist.js';
import type { RunbookEmbedder } from './embeddings.js';
import { RunbookError } from './errors.js';
import { sha256 } from './hashes.js';
import {
  RetrieveRunbookInputSchema,
  type RetrieveRunbookInput,
  type RetrieveRunbookResult,
} from './retrieve-contract.js';
import { auditRetrievalFailure } from './retrieval-audit.js';
import { queryAndRankEligibleChunks } from './retrieval-matches.js';
import type { RunbookVectorStore } from './vector-store.js';

export {
  RetrieveRunbookInputSchema,
  type RetrieveRunbookInput,
  type RetrieveRunbookResult,
} from './retrieve-contract.js';

const DEFAULT_TOP_K = 3;
const DEFAULT_THRESHOLD = 0.15;

export async function retrieveRunbook(
  store: OperationalStore,
  vectorStore: RunbookVectorStore,
  embedder: RunbookEmbedder,
  untrustedInput: RetrieveRunbookInput,
  options: Readonly<{
    topK?: number;
    threshold?: number;
    clock?: Clock;
    ids?: IdGenerator;
  }> = {},
): Promise<RetrieveRunbookResult> {
  const parsed = RetrieveRunbookInputSchema.safeParse(untrustedInput);
  if (!parsed.success) throw new RunbookError('RUNBOOK_INELIGIBLE');
  const input = parsed.data;
  const topK = options.topK ?? DEFAULT_TOP_K;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  if (
    !Number.isFinite(threshold) ||
    threshold < -1 ||
    threshold > 1 ||
    !Number.isInteger(topK) ||
    topK < 1 ||
    topK > 20
  ) {
    throw new RunbookError('RUNBOOK_INELIGIBLE');
  }
  const queryText = input.queryText.trim();
  const queryHash = sha256(queryText);
  if (!queryText) {
    await auditRetrievalFailure(store, input, queryHash, 'RUNBOOK_QUERY_EMPTY', threshold, topK, options);
    throw new RunbookError('RUNBOOK_QUERY_EMPTY');
  }
  let existing;
  try {
    existing = await findSuccessfulRetrieval(store, {
      ...input,
      queryHash,
      threshold,
      topK,
    });
  } catch {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  if (existing) return { ...existing, duplicate: true };

  let selection: PersistedSelection | undefined;
  try {
    selection = await claimRetrievalSelection(store, { ...input, queryHash, threshold, topK }, undefined, options);
  } catch {
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  if (!selection) {
    let eligible;
    try {
      eligible = await resolveEligibleGeneration(store, input.incidentKind);
    } catch (error) {
      const code =
        error instanceof RunbookError
          ? error.code
          : error instanceof DomainError && error.code === 'CONFLICT'
            ? 'RUNBOOK_INELIGIBLE'
            : 'RUNBOOK_BACKEND_UNAVAILABLE';
      await auditRetrievalFailure(store, input, queryHash, code, threshold, topK, options);
      throw new RunbookError(code, code === 'RUNBOOK_BACKEND_UNAVAILABLE');
    }
    if (!eligible) {
      await auditRetrievalFailure(store, input, queryHash, 'RUNBOOK_MISSING', threshold, topK, options);
      throw new RunbookError('RUNBOOK_MISSING');
    }
    try {
      selection = await claimRetrievalSelection(store, { ...input, queryHash, threshold, topK }, eligible, options);
    } catch {
      throw new RunbookError('RUNBOOK_INELIGIBLE');
    }
  }
  if (!selection) throw new RunbookError('RUNBOOK_INELIGIBLE');
  const generation = selection.generation;

  try {
    validatePersistedAllowedActions(input.incidentKind, generation.allowedActionsJson);
  } catch (error) {
    await auditRetrievalFailure(
      store,
      input,
      queryHash,
      'RUNBOOK_ACTION_NOT_ALLOWLISTED',
      threshold,
      topK,
      options,
      selection,
    );
    throw error;
  }

  let authoritative;
  try {
    authoritative = await listAuthoritativeChunks(store, generation.generationId);
  } catch {
    await auditRetrievalFailure(
      store,
      input,
      queryHash,
      'RUNBOOK_INTEGRITY_FAILED',
      threshold,
      topK,
      options,
      selection,
    );
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }
  const aggregate = sha256(
    [...authoritative.values()]
      .sort(
        (left, right) =>
          left.metadata.sectionOrdinal - right.metadata.sectionOrdinal ||
          left.metadata.chunkOrdinal - right.metadata.chunkOrdinal,
      )
      .map(chunk => `${chunk.metadata.chunkId}:${chunk.metadataHash}`)
      .join('\n'),
  );
  if (authoritative.size !== generation.chunkCount || aggregate !== generation.aggregateHash) {
    await auditRetrievalFailure(
      store,
      input,
      queryHash,
      'RUNBOOK_INTEGRITY_FAILED',
      threshold,
      topK,
      options,
      selection,
    );
    throw new RunbookError('RUNBOOK_INTEGRITY_FAILED');
  }

  let queryVector;
  try {
    queryVector = await embedder.embedQuery(queryText);
  } catch {
    await auditRetrievalFailure(
      store,
      input,
      queryHash,
      'RUNBOOK_BACKEND_UNAVAILABLE',
      threshold,
      topK,
      options,
      selection,
    );
    throw new RunbookError('RUNBOOK_BACKEND_UNAVAILABLE', true);
  }
  let ranked;
  try {
    ranked = await queryAndRankEligibleChunks(vectorStore, generation, authoritative, queryVector, threshold, topK);
  } catch (error) {
    const code = error instanceof RunbookError ? error.code : 'RUNBOOK_BACKEND_UNAVAILABLE';
    await auditRetrievalFailure(store, input, queryHash, code, threshold, topK, options, selection);
    throw new RunbookError(code, code === 'RUNBOOK_BACKEND_UNAVAILABLE');
  }
  if (ranked.length === 0) {
    await auditRetrievalFailure(
      store,
      input,
      queryHash,
      'RUNBOOK_SCORE_INSUFFICIENT',
      threshold,
      topK,
      options,
      selection,
    );
    throw new RunbookError('RUNBOOK_SCORE_INSUFFICIENT');
  }
  const retrievalId = await persistSuccessfulRetrieval(
    store,
    { ...input, queryHash, threshold, topK, selection, chunks: ranked },
    options,
  );
  return {
    retrievalId,
    runbookId: generation.runbookId,
    version: generation.version,
    generationId: generation.generationId,
    citation: selection.citation,
    chunkIds: ranked.map(chunk => chunk.metadata.chunkId),
    duplicate: false,
  };
}
