const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

export const resetStorage = async () => {
  return fetch(`${BASE_URL}/e2e/reset-storage`, {
    method: 'POST',
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to reset storage: ${res.statusText}`);
    }

    return res.json();
  });
};
