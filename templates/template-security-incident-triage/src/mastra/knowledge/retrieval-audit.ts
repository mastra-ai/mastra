import type { Clock } from '../../domain/clock.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { persistFailedRetrieval, type PersistedSelection } from '../../db/runbook-retrieval-operations.js';
import type { RunbookErrorCode } from './errors.js';
import type { RetrieveRunbookInput } from './retrieve-contract.js';

export async function auditRetrievalFailure(
  store: OperationalStore,
  input: RetrieveRunbookInput,
  queryHash: string,
  errorCode: RunbookErrorCode,
  threshold: number,
  topK: number,
  options: Readonly<{ clock?: Clock; ids?: IdGenerator }>,
  selection?: PersistedSelection,
): Promise<void> {
  await persistFailedRetrieval(store, { ...input, queryHash, errorCode, threshold, topK, selection }, options);
}
