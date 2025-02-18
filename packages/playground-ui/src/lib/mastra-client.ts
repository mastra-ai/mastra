import { MastraClient } from '@mastra/client-js';

const isDev = process.env.NODE_ENV === 'development';

export const mastraClient = (baseURL?: string, ignoreDev?: boolean) =>
  new MastraClient({
    baseUrl: ignoreDev ? baseURL! : isDev ? 'http://localhost:4111' : baseURL!,
  });
