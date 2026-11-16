import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { once } from 'node:events';

/** Consume an upstream response and drop its acknowledgement, surfacing forwarding failures to the caller. */
export async function lossyProxy(forward: (request: IncomingMessage) => Promise<void>) {
  let failure: { error: unknown } | undefined;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  const server = createServer(async (request, response) => {
    try {
      await forward(request);
    } catch (error) {
      failure = { error };
    } finally {
      request.socket.destroy();
      response.destroy();
      finish();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No proxy address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    completed: async () => {
      await finished;
      if (failure) throw failure.error;
    },
    close: async () => {
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    },
  };
}
