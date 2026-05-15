const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Seeds datasets via the Studio API. Returns the names created.
 * Names are created in order but listed newest-first by the API, so the
 * caller should reason about ordering accordingly.
 */
export const seedDatasets = async (count: number, namePrefix = 'E2E Dataset'): Promise<string[]> => {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${namePrefix} ${String(i + 1).padStart(2, '0')}`;
    const res = await fetch(`${BASE_URL}/api/datasets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Failed to seed dataset "${name}": ${res.status} ${res.statusText}`);
    }
    names.push(name);
  }
  return names;
};
