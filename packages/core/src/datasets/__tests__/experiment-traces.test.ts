import { describe, expect, it, vi } from 'vitest';
import type { MastraCompositeStore } from '../../storage/base.js';
import type { ExperimentsStorage } from '../../storage/domains/experiments/base.js';
import { deleteExperimentTraces } from '../experiment-traces.js';

/** Experiments store stub that pages through the given result rows. */
function makeExperimentsStore(pages: Array<Array<{ traceId: string | null }>>) {
  const listExperimentResults = vi.fn(async ({ pagination }: any) => {
    const results = pages[pagination.page] ?? [];
    return {
      results,
      pagination: {
        total: 0,
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: pagination.page < pages.length - 1,
      },
    };
  });
  return { listExperimentResults } as unknown as ExperimentsStorage & {
    listExperimentResults: ReturnType<typeof vi.fn>;
  };
}

function makeStorage(observability: { batchDeleteTraces: ReturnType<typeof vi.fn> } | null) {
  return { getStore: vi.fn(async () => observability) } as unknown as MastraCompositeStore;
}

function storageError(id: string) {
  return Object.assign(new Error(`storage said no: ${id}`), { id });
}

const logger = { warn: vi.fn() } as any;

describe('deleteExperimentTraces', () => {
  it('deletes the distinct trace ids recorded across every result page', async () => {
    const batchDeleteTraces = vi.fn(async () => {});
    const experimentsStore = makeExperimentsStore([
      [{ traceId: 'trace-a' }, { traceId: 'trace-a' }, { traceId: null }],
      [{ traceId: 'trace-b' }],
    ]);

    const deleted = await deleteExperimentTraces({
      storage: makeStorage({ batchDeleteTraces }),
      experimentsStore,
      experimentId: 'exp-1',
    });

    expect(deleted).toEqual(['trace-a', 'trace-b']);
    expect(batchDeleteTraces).toHaveBeenCalledWith({ traceIds: ['trace-a', 'trace-b'] });
  });

  it('forwards the organization scope when the caller is tenancy scoped', async () => {
    const batchDeleteTraces = vi.fn(async () => {});

    await deleteExperimentTraces({
      storage: makeStorage({ batchDeleteTraces }),
      experimentsStore: makeExperimentsStore([[{ traceId: 'trace-a' }]]),
      experimentId: 'exp-1',
      filters: { organizationId: 'org_a', projectId: 'proj_1' },
    });

    expect(batchDeleteTraces).toHaveBeenCalledWith({ traceIds: ['trace-a'], organizationId: 'org_a' });
  });

  it('skips the cascade when the experiment recorded no traces', async () => {
    const batchDeleteTraces = vi.fn(async () => {});

    const deleted = await deleteExperimentTraces({
      storage: makeStorage({ batchDeleteTraces }),
      experimentsStore: makeExperimentsStore([[{ traceId: null }]]),
      experimentId: 'exp-1',
    });

    expect(deleted).toEqual([]);
    expect(batchDeleteTraces).not.toHaveBeenCalled();
  });

  it('warns and keeps the traces when the store has no observability domain', async () => {
    const warn = vi.fn();

    const deleted = await deleteExperimentTraces({
      storage: makeStorage(null),
      experimentsStore: makeExperimentsStore([[{ traceId: 'trace-a' }]]),
      experimentId: 'exp-1',
      logger: { warn } as any,
    });

    expect(deleted).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('exp-1'));
  });

  it.each([
    'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_NOT_IMPLEMENTED',
    'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_SCOPE_NOT_SUPPORTED',
  ])('warns instead of failing the delete when the store cannot cascade (%s)', async id => {
    const warn = vi.fn();
    const batchDeleteTraces = vi.fn(async () => {
      throw storageError(id);
    });

    const deleted = await deleteExperimentTraces({
      storage: makeStorage({ batchDeleteTraces }),
      experimentsStore: makeExperimentsStore([[{ traceId: 'trace-a' }]]),
      experimentId: 'exp-1',
      logger: { warn } as any,
    });

    expect(deleted).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('exp-1'));
  });

  it('rethrows unexpected storage failures so the delete does not silently half-succeed', async () => {
    const batchDeleteTraces = vi.fn(async () => {
      throw storageError('OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_FAILED');
    });

    await expect(
      deleteExperimentTraces({
        storage: makeStorage({ batchDeleteTraces }),
        experimentsStore: makeExperimentsStore([[{ traceId: 'trace-a' }]]),
        experimentId: 'exp-1',
        logger,
      }),
    ).rejects.toThrow('storage said no');
  });
});
