import { MastraClient } from '@mastra/client-js';

export const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
  headers: {
    'x-mastra-dev-playground': 'true',
  },
});
