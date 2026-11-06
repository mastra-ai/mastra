import { Mastra } from '@mastra/core/mastra';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { MastraModule } from '../index';

describe('route-level body size limits', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  async function start() {
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: new Mastra({ logger: false }) })],
    }).compile();
    // Nest's own 100 KiB parser would mask the route limit, so let MastraModule's
    // JSON middleware (10 MB default) parse the body, as most apps configure it.
    const app = moduleRef.createNestApplication({ logger: false, bodyParser: false });
    await app.listen(0, '127.0.0.1');
    close = () => app.close();
    return app.getUrl();
  }

  it('rejects a JSON body over the route maxBodySize with 413', async () => {
    const baseUrl = await start();
    // /observability/traces/query caps bodies at 256 KiB, well under the global default.
    const body = JSON.stringify({ padding: 'x'.repeat(300 * 1024) });

    const res = await fetch(`${baseUrl}/api/observability/traces/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    expect(res.status).toBe(413);
  });

  describe('without a Content-Length header', () => {
    function postChunked(baseUrl: string, body: string) {
      const bytes = new TextEncoder().encode(body);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 16 * 1024) controller.enqueue(bytes.slice(i, i + 16 * 1024));
          controller.close();
        },
      });
      return fetch(`${baseUrl}/api/observability/traces/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit);
    }

    it('rejects a chunked JSON body over the route maxBodySize with 413', async () => {
      const baseUrl = await start();
      const res = await postChunked(baseUrl, JSON.stringify({ padding: 'x'.repeat(300 * 1024) }));

      expect(res.status).toBe(413);
    });

    it('lets a chunked JSON body under the route maxBodySize reach the handler', async () => {
      const baseUrl = await start();
      const res = await postChunked(baseUrl, JSON.stringify({ padding: 'x' }));

      expect(res.status).not.toBe(413);
    });
  });
});
