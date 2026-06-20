import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { findAvailablePort } from './ports';

describe('findAvailablePort', () => {
  it('skips occupied preferred ports', async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP address');
    }

    const availablePort = await findAvailablePort(address.port);
    expect(availablePort).not.toBe(address.port);

    await new Promise<void>(resolve => server.close(() => resolve()));
  });
});
