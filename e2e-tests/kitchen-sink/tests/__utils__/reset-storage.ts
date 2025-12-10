export const resetStorage = async () => {
  console.log('[Mastra] Resetting storage');
  return fetch('http://localhost:4111/e2e/reset-storage', {
    method: 'POST',
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Failed to reset storage: ${res.statusText}`);
    }
    console.log('[Mastra] Storage reset');
    return res.json();
  });
};
