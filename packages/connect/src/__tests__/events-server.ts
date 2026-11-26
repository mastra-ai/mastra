import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * A local events service. Each request is answered by the next handler in
 * order; the last handler answers any further requests.
 */
export async function eventsServer(handlers: Handler[]) {
  const requests: IncomingMessage[] = [];
  const open = new Set<ServerResponse>();
  const server: Server = createServer((req, res) => {
    requests.push(req);
    open.add(res);
    res.on('close', () => open.delete(res));
    const handler = handlers[Math.min(requests.length - 1, handlers.length - 1)]!;
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    async close() {
      for (const res of open) res.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

export function startStream(res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store, private' });
}

export function ready(cursor: string, retry = 1000) {
  return `event: ready\nid: ${cursor}\nretry: ${retry}\ndata: \n\n`;
}

export function event(id: string, fields: Record<string, string>, timestamp = 1_700_000_000_000) {
  return `event: event\nid: ${id}\ndata: ${JSON.stringify({ id, timestamp, fields })}\n\n`;
}
