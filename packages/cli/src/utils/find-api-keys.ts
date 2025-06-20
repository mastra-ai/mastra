import { env } from 'node:process';

export function findApiKeys() {
  const apiKeyPattern = /_API_KEY$/;

  const apiKeys = Object.entries(env)
    .filter(([key, value]) => apiKeyPattern.test(key) && value)
    .map(([key, value]) => ({ name: key, value }));

  return apiKeys;
}
