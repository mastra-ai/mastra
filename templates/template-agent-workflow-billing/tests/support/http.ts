import { createServer } from 'node:http';
import { once } from 'node:events';

export async function billingSocket(app: { fetch(request: Request): Response | Promise<Response> }) {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await app.fetch(
      new Request(`http://127.0.0.1${request.url}`, {
        method: request.method,
        headers: request.headers as Record<string, string>,
        ...(['GET', 'HEAD'].includes(request.method!) ? {} : { body: Buffer.concat(chunks) }),
      }),
    );
    const headers: Record<string, string> = {};
    result.headers.forEach((value, key) => {
      headers[key] = value;
    });
    response.writeHead(result.status, headers);
    response.end(Buffer.from(await result.arrayBuffer()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    },
  };
}
