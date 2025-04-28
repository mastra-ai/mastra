import { MastraClient } from '@mastra/client-js';

export const createMastraClient = (baseUrl?: string) => {
  return new MastraClient({
    baseUrl: baseUrl || '',
    // only add the header if the baseUrl is not provided i.e it's a local dev environment
    headers: !baseUrl ? { 'x-mastra-dev-playground': 'true' } : {},
  });
};
