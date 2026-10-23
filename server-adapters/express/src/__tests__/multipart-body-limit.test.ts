import { request as createHttpRequest } from 'node:http';
import type { Server } from 'node:http';
import { Mastra } from '@mastra/core';
import type { ServerRoute } from '@mastra/server/server-adapter';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const maxSize = 1024;
const boundary = 'express-body-limit-boundary';

const multipart = (parts: Array<{ name: string; value: string; filename?: string }>) =>
  parts
    .map(
      p =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"` +
        (p.filename ? `; filename="${p.filename}"\r\nContent-Type: application/octet-stream` : '') +
        `\r\n\r\n${p.value}\r\n`,
    )
    .join('') + `--${boundary}--\r\n`;

describe('Express multipart body limit without Content-Length', () => {
  let server: Server | undefined;
  let handlerCalls = 0;

  afterEach(async () => {
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
    handlerCalls = 0;
  });

  async function start() {
    const app = express();
    app.use(express.json());
    const adapter = new MastraServer({
      app,
      mastra: new Mastra({}),
      bodyLimitOptions: { maxSize, onError: () => ({ error: 'Request body too large' }) },
    });
    app.use(adapter.createContextMiddleware());
    const route: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/upload',
      responseType: 'json',
      handler: async () => {
        handlerCalls++;
        return { ok: true };
      },
    };
    await adapter.registerRoute(app, route, { prefix: '' });
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    return address.port;
  }

  function sendChunked(port: number, body: string) {
    return new Promise<{ status: number; body: string; connection?: string }>((resolve, reject) => {
      let responded = false;
      const req = createHttpRequest(
        {
          hostname: '127.0.0.1',
          port,
          path: '/upload',
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Transfer-Encoding': 'chunked' },
        },
        res => {
          responded = true;
          let text = '';
          res.setEncoding('utf8');
          res.on('data', chunk => (text += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text, connection: res.headers.connection }));
        },
      );
      // The server answers 413 with Connection: close, so once a response has started,
      // a broken pipe or reset from our pending writes is expected.
      req.on('error', err => {
        const code = (err as NodeJS.ErrnoException).code;
        if (responded && (code === 'EPIPE' || code === 'ECONNRESET')) return;
        reject(err);
      });
      // Write one chunk at a time and stop as soon as the server responds.
      const writeFrom = (offset: number) => {
        if (responded || req.destroyed) return;
        if (offset >= body.length) return void req.end();
        req.write(body.slice(offset, offset + 256), () => writeFrom(offset + 256));
      };
      writeFrom(0);
    });
  }

  it.each([
    [
      'many small files',
      multipart(
        Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, filename: `${i}.bin`, value: 'x'.repeat(500) })),
      ),
    ],
    ['many small fields', multipart(Array.from({ length: 20 }, (_, i) => ({ name: `f${i}`, value: 'x'.repeat(500) })))],
    ['one oversized field', multipart([{ name: 'field', value: 'x'.repeat(maxSize * 4) }])],
    ['one oversized file', multipart([{ name: 'file', filename: 'f.bin', value: 'x'.repeat(maxSize * 4) }])],
  ])('rejects %s with 413 and the onError body before the handler runs', async (_name, body) => {
    const port = await start();
    const response = await sendChunked(port, body);

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({ error: 'Request body too large', code: 'REQUEST_BODY_TOO_LARGE' });
    expect(response.connection).toBe('close');
    expect(handlerCalls).toBe(0);
  });

  it('accepts a multipart body within the limit', async () => {
    const port = await start();
    const response = await sendChunked(port, multipart([{ name: 'a', value: 'ok' }]));

    expect(response.status).toBe(200);
    expect(handlerCalls).toBe(1);
  });
});
