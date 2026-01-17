const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

export const resetStorage = async () => {
  console.log('[Mastra] Resetting storage');
  return fetch(`${BASE_URL}/e2e/reset-storage`, {
    method: 'POST',
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to reset storage: ${res.statusText}`);
    }
    console.log('[Mastra] Storage reset');
    return res.json();
  });
};
