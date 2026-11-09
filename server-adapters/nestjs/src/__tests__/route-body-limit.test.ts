import http from 'node:http';
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

  it('rejects a chunked JSON body whose raw bytes exceed the route limit', async () => {
    const baseUrl = await start();
    const { hostname, port } = new URL(baseUrl);
    // Tiny JSON value padded with spaces past the 256 KiB route cap. After parse,
    // JSON.stringify would shrink this under the limit.
    const padded = '{"ok":true}' + ' '.repeat(300 * 1024);

    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          hostname,
          port: Number(port),
          path: '/api/observability/traces/query',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'transfer-encoding': 'chunked',
          },
        },
        res => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        },
      );
      req.on('error', reject);
      req.write(padded);
      req.end();
    });

    expect(status).toBe(413);
  });
});
