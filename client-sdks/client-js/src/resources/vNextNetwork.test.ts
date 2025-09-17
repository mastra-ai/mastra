import type { Server } from 'http';
import { createServer } from 'http';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { ClientOptions } from '../types';
import { VNextNetwork } from './vNextNetwork';

describe('VNextNetwork.stream', () => {
  let server: Server;
  let network: VNextNetwork;
  let onRecord: Mock;
  let port: number;
  let serverResponse: string | null = null;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url?.includes('/api/networks/v-next') && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (serverResponse) {
          res.write(serverResponse);
        }
        res.end();
      }
    });

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  beforeEach(() => {
    serverResponse = null;

    const clientOptions: ClientOptions = {
      apiKey: 'test-key',
      baseUrl: `http://localhost:${port}`,
    };
    network = new VNextNetwork(clientOptions, 'test-network-id');
    onRecord = vi.fn();
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('should parse string records with JSON.parse before passing to onRecord', async () => {
    // Arrange: Setup string record that requires parsing
    const recordObject = { message: 'Hello', type: 'text' };
    const stringifiedRecord = JSON.stringify(recordObject);
    // Double stringify to simulate string record that needs parsing
    const doubleStringified = JSON.stringify(stringifiedRecord);
    serverResponse = doubleStringified + '\n';

    // Act: Call stream with test parameters
    await network.stream({ message: 'test message' }, onRecord);

    // Assert: Verify onRecord was called with parsed object
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(recordObject);
  });

  it('should pass non-string records directly to onRecord without parsing', async () => {
    // Arrange: Setup direct object record
    const recordObject = { message: 'Direct', type: 'object' };
    // Send as direct JSON, not stringified twice
    serverResponse = JSON.stringify(recordObject) + '\n';

    // Act: Call stream with test parameters
    await network.stream({ message: 'test message' }, onRecord);

    // Assert: Verify onRecord was called with object directly
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(recordObject);
  });
});
