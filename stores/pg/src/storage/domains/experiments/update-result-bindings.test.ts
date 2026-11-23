import { describe, expect, it, vi } from 'vitest';

import { ExperimentsPG } from '.';

const resultRow = {
  id: 'result-1',
  experimentId: 'experiment-1',
  itemId: 'item-1',
  itemDatasetVersion: 1,
  organizationId: null,
  projectId: null,
  input: null,
  output: null,
  groundTruth: null,
  metadata: null,
  error: null,
  startedAt: new Date('2026-09-07T00:00:00.000Z'),
  completedAt: new Date('2026-09-07T00:00:01.000Z'),
  retryCount: 0,
  attempt: 0,
  traceId: null,
  status: 'reviewed',
  tags: null,
  toolMockReport: null,
  comment: null,
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
};

function createExperiments() {
  const oneOrNone = vi
    .fn()
    .mockResolvedValueOnce({ datasetId: null, itemId: 'item-1' })
    .mockResolvedValueOnce(resultRow);
  const tx = { oneOrNone };
  const client = {
    tx: vi.fn(async callback => callback(tx)),
  };

  return {
    experiments: new ExperimentsPG({ client: client as never }),
    oneOrNone,
  };
}

describe('ExperimentsPG update result bindings', () => {
  it('omits the experiment ID value when the update is not scoped to an experiment', async () => {
    const { experiments, oneOrNone } = createExperiments();

    await experiments.updateExperimentResult({ id: 'result-1', status: 'reviewed' });

    expect(oneOrNone.mock.calls[1]?.[0]).not.toContain('"experimentId" = $9');
    expect(oneOrNone.mock.calls[1]?.[1]).toHaveLength(8);
  });

  it('passes the experiment ID value when the update is scoped to an experiment', async () => {
    const { experiments, oneOrNone } = createExperiments();

    await experiments.updateExperimentResult({
      id: 'result-1',
      experimentId: 'experiment-1',
      status: 'reviewed',
    });

    expect(oneOrNone.mock.calls[1]?.[0]).toContain('"experimentId" = $9');
    expect(oneOrNone.mock.calls[1]?.[1]).toHaveLength(9);
    expect(oneOrNone.mock.calls[1]?.[1][8]).toBe('experiment-1');
  });

  it('preserves an explicitly empty experiment ID as an update scope', async () => {
    const { experiments, oneOrNone } = createExperiments();

    await experiments.updateExperimentResult({ id: 'result-1', experimentId: '', status: 'reviewed' });

    expect(oneOrNone.mock.calls[0]?.[0]).toContain('r."experimentId" = $2');
    expect(oneOrNone.mock.calls[0]?.[1]).toEqual(['result-1', '']);
    expect(oneOrNone.mock.calls[1]?.[0]).toContain('"experimentId" = $9');
    expect(oneOrNone.mock.calls[1]?.[1][8]).toBe('');
  });
});
