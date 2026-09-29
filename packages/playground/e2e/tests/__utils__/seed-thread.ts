const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

/** Seeds a weather-agent thread with `count` user messages "seed message 0..count-1", oldest first. */
export const seedThread = async (threadId: string, count: number) => {
  const res = await fetch(`${BASE_URL}/e2e/seed-thread`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ threadId, count }),
  });
  if (!res.ok) {
    throw new Error(`Failed to seed thread "${threadId}": ${res.status} ${res.statusText}`);
  }
};
