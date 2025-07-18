import { MastraClient } from '@mastra/client-js';

export const createMastraClient = (baseUrl?: string, mastraClientHeaders: Record<string, string> = {}) => {
  const compatHeaders = {
    'x-ai-sdk-compat': 'v4',
    ...mastraClientHeaders,
  };

  return new MastraClient({
    baseUrl: baseUrl || '',
    // only add the header if the baseUrl is not provided i.e it's a local dev environment
    headers: !baseUrl ? { ...compatHeaders, 'x-mastra-dev-playground': 'true' } : compatHeaders,
  });
};
