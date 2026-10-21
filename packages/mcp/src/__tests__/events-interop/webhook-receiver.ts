import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** One request the receiver handled: `type` is `verification` or a control type, absent for deliveries. */
export interface ReceivedRequest {
  status: number;
  type?: string;
  subscriptionId?: string;
}

/**
 * A local `http` receiver standing in for the client's public webhook route: it turns every request
 * into a Fetch `Request`, passes it to `handle` (normally `mcp.events.handleWebhook`), and records it.
 */
export async function serveWebhookReceiver(handle: (request: Request) => Promise<Response>) {
  const requests: ReceivedRequest[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const response = await handle(
      new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers,
        ...(req.method === 'POST' ? { body } : {}),
      }),
    );
    let type: string | undefined;
    try {
      const parsed = JSON.parse(body.toString()) as { type?: unknown };
      if (typeof parsed.type === 'string') type = parsed.type;
    } catch {
      // Not JSON; recorded without a type.
    }
    const subscriptionId = headers.get('x-mcp-subscription-id') ?? undefined;
    requests.push({
      status: response.status,
      ...(type ? { type } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/webhook`,
    requests,
    /** Occurrence deliveries only (no verification or control requests). */
    deliveries: () => requests.filter(request => request.type === undefined),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

export async function waitFor(condition: () => boolean, timeoutMs = 5000, what = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
