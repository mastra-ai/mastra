import type { IMastraLogger } from '../logger/index.js';
import type { MastraCompositeStore } from '../storage/base.js';
import type { ExperimentsStorage } from '../storage/domains/experiments/base.js';
import { BATCH_DELETE_TRACES_MAX_IDS } from '../storage/domains/observability/tracing.js';
import type { ExperimentTenancyFilters } from '../storage/types.js';

/** Page size used when walking an experiment's results to collect trace ids. */
const TRACE_ID_COLLECTION_PAGE_SIZE = 100;

/**
 * Storage error ids that mean "this adapter cannot run the trace cascade".
 * They are downgraded to a warning so relational experiment deletion still
 * succeeds on stores without an observability domain (or without tenant-scoped
 * trace deletion) instead of failing the whole delete.
 */
const UNSUPPORTED_CASCADE_ERROR_IDS = new Set([
  'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_NOT_IMPLEMENTED',
  'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_SCOPE_NOT_SUPPORTED',
]);

function isUnsupportedCascadeError(error: unknown): boolean {
  const id = (error as { id?: unknown })?.id;
  return typeof id === 'string' && UNSUPPORTED_CASCADE_ERROR_IDS.has(id);
}

/** Collects the distinct, non-null trace ids recorded on an experiment's results. */
async function collectExperimentTraceIds(args: {
  experimentsStore: ExperimentsStorage;
  experimentId: string;
  filters?: ExperimentTenancyFilters;
}): Promise<string[]> {
  const traceIds = new Set<string>();
  let page = 0;

  for (;;) {
    const { results, pagination } = await args.experimentsStore.listExperimentResults({
      experimentId: args.experimentId,
      ...(args.filters !== undefined ? { filters: args.filters } : {}),
      pagination: { page, perPage: TRACE_ID_COLLECTION_PAGE_SIZE },
    });

    for (const result of results) {
      if (result.traceId) traceIds.add(result.traceId);
    }

    if (!pagination.hasMore || results.length === 0) break;
    page += 1;
  }

  return [...traceIds];
}

/**
 * Deletes the observability traces produced by an experiment, along with everything
 * `batchDeleteTraces` cascades to (spans, trace roots/branches, and trace-linked
 * scores, feedback, metrics and logs).
 *
 * Trace ids come from the experiment's own result rows, which are read with the
 * caller's tenancy filters — so only traces belonging to the caller's experiment
 * are ever collected. The tenant scope is forwarded to storage as defense in depth.
 *
 * Must run *before* the relational delete: `deleteExperiment` cascades away the
 * result rows that carry the trace ids.
 *
 * @returns the trace ids that were passed to the cascade, or an empty array when
 * the experiment recorded none or the store cannot perform the cascade.
 */
export async function deleteExperimentTraces(args: {
  storage: MastraCompositeStore;
  experimentsStore: ExperimentsStorage;
  experimentId: string;
  filters?: ExperimentTenancyFilters;
  logger?: IMastraLogger;
}): Promise<string[]> {
  const traceIds = await collectExperimentTraceIds({
    experimentsStore: args.experimentsStore,
    experimentId: args.experimentId,
    ...(args.filters !== undefined ? { filters: args.filters } : {}),
  });
  if (traceIds.length === 0) return [];

  const observabilityStore = await args.storage.getStore('observability');
  if (!observabilityStore) {
    args.logger?.warn(
      `Skipping trace deletion for experiment ${args.experimentId}: storage has no observability domain. ${traceIds.length} trace(s) were left in place.`,
    );
    return [];
  }

  const organizationId = args.filters?.organizationId;

  try {
    for (let i = 0; i < traceIds.length; i += BATCH_DELETE_TRACES_MAX_IDS) {
      await observabilityStore.batchDeleteTraces({
        traceIds: traceIds.slice(i, i + BATCH_DELETE_TRACES_MAX_IDS),
        ...(organizationId !== undefined ? { organizationId } : {}),
      });
    }
  } catch (error) {
    if (!isUnsupportedCascadeError(error)) throw error;
    args.logger?.warn(
      `Skipping trace deletion for experiment ${args.experimentId}: ${(error as Error).message}. ${traceIds.length} trace(s) were left in place.`,
    );
    return [];
  }

  return traceIds;
}
