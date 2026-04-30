import Fastify from 'fastify';
import { describe, it, expect } from 'vitest';
import { MastraServer } from './index';

describe('Multipart Size Limit (Bug Fix)', () => {
  it('should reject when file exceeds maxFileSize (busboy limit)', async () => {
    //  Increase Fastify bodyLimit so it DOES NOT block first
    const app = Fastify({
      bodyLimit: 10 * 1024 * 1024, // 10MB
    });

    const adapter = new MastraServer({
      app,
      mastra: {
        getLogger: () => ({
          error: () => {}, // stub logger to avoid crashes
        }),
      } as any,
      bodyLimitOptions: { maxSize: 100 }, // small file limit (busboy)
    });

    //registers multipart parser + context middleware
    adapter.registerContextMiddleware();

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

    try {
      const boundary = '----testboundary';
      const bigData = 'a'.repeat(1000); // exceeds 100 bytes (busboy limit)

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

      const text = await res.text();
      expect(text.toLowerCase()).toContain('size');
    } finally {
      await app.close();
    }
  });
});
