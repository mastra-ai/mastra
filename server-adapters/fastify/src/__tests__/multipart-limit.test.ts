import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { MastraServer } from '../index';

describe('Multipart Size Limit (Bug Fix)', () => {
  it('should reject when file exceeds maxFileSize', async () => {
    const app = Fastify();

    const adapter = new MastraServer({
      app,
      mastra: {} as any,
      bodyLimitOptions: { maxSize: 100 },
    });

    app.addHook('preHandler', adapter.createContextMiddleware());

    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/upload',
        responseType: 'json',
        handler: async () => ({ ok: true }),
      },
      { prefix: '' },
    );

    const address = await app.listen({ port: 0 });

    const boundary = '----testboundary';
    const bigData = 'a'.repeat(1000);

    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${bigData}\r\n` +
      `--${boundary}--`;

    const res = await fetch(`${address}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    await app.close();
  });
});
