import { createServer } from 'node:net';
import type { Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import { findAvailablePort } from './ports';

async function listen(server: Server, host?: string) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    if (host) {
      server.listen(0, host, resolve);
      return;
    }

    server.listen(0, resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP address');
  }

  return address.port;
}

async function close(server: Server) {
  await new Promise<void>(resolve => server.close(() => resolve()));
}

describe('findAvailablePort', () => {
  it('skips preferred ports occupied on localhost', async () => {
    const server = createServer();
    const occupiedPort = await listen(server, '127.0.0.1');

    try {
      const availablePort = await findAvailablePort(occupiedPort);
      expect(availablePort).not.toBe(occupiedPort);
    } finally {
      await close(server);
    }
  });

  it('skips preferred ports occupied on all interfaces', async () => {
    const server = createServer();
    const occupiedPort = await listen(server);

    try {
      const availablePort = await findAvailablePort(occupiedPort);
      expect(availablePort).not.toBe(occupiedPort);
    } finally {
      await close(server);
    }
  });
});
