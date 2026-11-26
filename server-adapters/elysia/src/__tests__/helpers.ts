import { createServer } from 'node:http';
import type { OutgoingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type Elysia from 'elysia';

/**
 * Starts a real Node HTTP server that delegates requests to an Elysia app's fetch method.
 * This is needed for tests that use `fetch()` directly (multipart, OpenAPI, custom routes, MCP transport).
 */
export async function startElysiaServer(app: Elysia): Promise<{
  baseUrl: string;
  cleanup: () => Promise<void>;
  server: Server;
}> {
  const server = createServer(async (req, res) => {
    try {
      const protocol = 'http';
      const host = req.headers.host ?? 'localhost';
      const url = `${protocol}://${host}${req.url}`;

      const headers = new Headers();
      for (const key of Object.keys(req.headers)) {
        const value = req.headers[key];
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(',') : value);
        }
      }

      let body: ReadableStream<Uint8Array> | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          const combined = Buffer.concat(chunks);
          body = new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(combined));
              controller.close();
            },
          });
        }
      }

      // Mirror real runtimes (Bun, @hono/node-server): abort the Request when the client goes away.
      const abortController = new AbortController();
      res.on('close', () => {
        if (!res.writableFinished) abortController.abort();
      });

      const request = new Request(url, {
        method: req.method,
        headers,
        body,
        signal: abortController.signal,
        ...(body ? { duplex: 'half' } : {}),
      } as RequestInit);

      const response = await app.fetch(request);

      const responseHeaders: OutgoingHttpHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      res.writeHead(response.status, responseHeaders);

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });

  await new Promise<void>(resolve => {
    server.listen(0, 'localhost', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;

  return {
    baseUrl: `http://localhost:${port}`,
    server,
    cleanup: async () => {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
    },
  };
}

/** The srvx server behind @elysiajs/node, which `listen` hands back as `raw`. */
type SrvxNodeServer = {
  ready(): Promise<unknown>;
  node?: { server?: Server };
  close(closeActiveConnections?: boolean): Promise<void>;
};

/**
 * Serves an app through Elysia's official Node adapter, the way production does.
 *
 * `listen` calls back before the socket accepts connections and reports port 0
 * back for an ephemeral port, so wait for srvx's `ready()` and read the bound
 * port from the socket. Binds 127.0.0.1 (not `localhost`, which can resolve to
 * `::1`) and without `reusePort`, so no other process can share the port.
 */
export async function listenWithNodeAdapter(app: Elysia): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = await new Promise<SrvxNodeServer>(resolve =>
    app.listen({ port: 0, hostname: '127.0.0.1', reusePort: false }, started => {
      resolve((started as unknown as { raw: SrvxNodeServer }).raw);
    }),
  );
  await server.ready();
  const { port } = server.node!.server!.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    // Also drops open connections, so a stuck stream can't hold teardown.
    close: () => server.close(true),
  };
}
