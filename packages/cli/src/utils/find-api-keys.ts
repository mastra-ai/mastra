export function findApiKeys() {
  const apiKeyPattern = /_API_KEY$/;

  const apiKeys = Object.entries(process.env)
    .filter(([key, value]) => apiKeyPattern.test(key) && value)
    .map(([key, value]) => ({ name: key, value }));

  return apiKeys;
}
