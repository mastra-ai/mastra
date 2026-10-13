import { SimpleAuth } from '@mastra/core/server';

export function studioAuth(env: NodeJS.ProcessEnv = process.env) {
  // Mastra dev also sets NODE_ENV=production; its explicit flag identifies Studio development.
  if (env.NODE_ENV !== 'production' || env.MASTRA_DEV === 'true') return undefined;

  const token = env.MASTRA_STUDIO_TOKEN?.trim();
  if (!token) throw new Error('MASTRA_STUDIO_TOKEN_REQUIRED');

  return new SimpleAuth({ tokens: { [token]: { id: 'operator', role: 'admin' } } });
}
