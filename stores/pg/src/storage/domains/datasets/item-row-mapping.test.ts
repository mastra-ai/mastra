import { describe, expect, it, vi } from 'vitest';

import { DatasetsPG } from '.';

const row = {
  id: 'item-1',
  datasetId: 'dataset-1',
  datasetVersion: 1,
  externalId: null,
  organizationId: null,
  projectId: null,
  validTo: null,
  isDeleted: false,
  input: 0,
  groundTruth: false,
  expectedTrajectory: null,
  toolMocks: null,
  unmockedToolPolicy: null,
  scorerIds: null,
  requestContext: 0,
  metadata: {},
  source: '',
  createdAtZ: '2026-09-08T00:00:00.000Z',
  updatedAtZ: '2026-09-08T00:00:01.000Z',
};

function createDatasets() {
  const readClient = {
    oneOrNone: vi.fn().mockResolvedValue(row),
    manyOrNone: vi.fn().mockResolvedValue([row]),
  };

  return new DatasetsPG({ client: readClient as never, readClient: readClient as never });
}

describe('DatasetsPG item row mapping', () => {
  it('preserves falsy JSON scalars in current item reads', async () => {
    const datasets = createDatasets();

    const item = await datasets.getItemById({ id: row.id });

    expect(item).toMatchObject({ input: 0, groundTruth: false, requestContext: 0, source: '' });
  });

  it('preserves falsy JSON scalars in item history reads', async () => {
    const datasets = createDatasets();

    const [item] = await datasets.getItemHistory(row.id);

    expect(item).toMatchObject({ input: 0, groundTruth: false, requestContext: 0, source: '' });
  });
});
