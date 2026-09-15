import { describe, it } from 'vitest';
import { registerApiRoute } from '@mastra/core/server';
import type { MiddlewareHandler } from 'hono';

declare const middleware: MiddlewareHandler;

describe('server types across the published package boundary', () => {
  it('accepts a consumer Hono middleware handler', () => {
    registerApiRoute('/test', {
      method: 'GET',
      middleware,
      createHandler: async () => async () => new Response(),
    });
  });
});
