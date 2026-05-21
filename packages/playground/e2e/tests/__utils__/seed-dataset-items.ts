const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

export interface SeededDataset {
  id: string;
  name: string;
  itemIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Creates a dataset with items via the Studio API.
 * Returns dataset ID, name, and item IDs.
 */
export const seedDatasetWithItems = async (
  itemCount: number,
  datasetName = 'E2E Items Dataset',
): Promise<SeededDataset> => {
  const datasetRes = await fetch(`${BASE_URL}/api/datasets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: datasetName }),
  });

  if (!datasetRes.ok) {
    throw new Error(`Failed to create dataset: ${datasetRes.status} ${datasetRes.statusText}`);
  }

  const datasetBody: unknown = await datasetRes.json();
  if (!isRecord(datasetBody) || typeof datasetBody.id !== 'string') {
    throw new Error('Dataset response missing id field');
  }
  const dataset = { id: datasetBody.id };

  const items = Array.from({ length: itemCount }, (_, i) => ({
    input: `Test input ${i + 1}`,
    groundTruth: `Expected output ${i + 1}`,
  }));

  const itemsRes = await fetch(`${BASE_URL}/api/datasets/${dataset.id}/items/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!itemsRes.ok) {
    throw new Error(`Failed to add items: ${itemsRes.status} ${itemsRes.statusText}`);
  }

  const itemsBody: unknown = await itemsRes.json();
  if (
    !isRecord(itemsBody) ||
    !Array.isArray(itemsBody.items) ||
    !itemsBody.items.every(item => isRecord(item) && typeof item.id === 'string')
  ) {
    throw new Error('Items response missing items array with id fields');
  }
  const itemsData = { items: itemsBody.items };

  return {
    id: dataset.id,
    name: datasetName,
    itemIds: itemsData.items.map(i => i.id),
  };
};
