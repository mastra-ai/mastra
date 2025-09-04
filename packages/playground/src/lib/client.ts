import { MastraClient } from '@mastra/client-js';

export const client = new MastraClient({
  baseUrl: '',
  headers: {
    'x-mastra-dev-playground': 'true',
  },
});
