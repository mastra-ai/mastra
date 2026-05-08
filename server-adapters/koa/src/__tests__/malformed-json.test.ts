/**
 * Test suite for malformed JSON body handling
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/12310
 *
 * Verifies that koa-bodyparser middleware correctly returns 400 for malformed JSON.
 */
import http from 'node:http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Malformed JSON Body Handling', () => {
  let app: Koa;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    app = new Koa();
    app.use(bodyParser());

    // Simple middleware to handle POST /test
    app.use(async ctx => {
      if (ctx.method === 'POST' && ctx.path === '/test') {
        ctx.body = { received: ctx.request.body };
      }
    });

    server = http.createServer(app.callback());
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://localhost:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  describe('koa-bodyparser middleware behavior', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": "json"', // Missing closing brace
      });

      expect(response.status).toBe(400);
    });

    it('should return 200 for valid JSON', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"valid": "json"}',
      });

      expect(response.status).toBe(200);
    });

    it('should handle empty body gracefully', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      // koa-bodyparser handles empty body gracefully
      expect(response.status).toBeLessThan(500);
    });
  });
});
