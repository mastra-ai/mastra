import type { MongoClient } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStorageMongoDB } from '../domains/memory';
import { WorkflowsStorageMongoDB } from '../domains/workflows';
import { MongoDBConnector } from './MongoDBConnector';

/** A connector whose `hello` topology probe is `hello`. */
function stubbedConnector(hello: () => Promise<Record<string, unknown>>) {
  const command = vi.fn(hello);
  const client = {
    connect: async () => {},
    db: () => ({ admin: () => ({ command }) }),
  } as unknown as MongoClient;
  return { connector: new MongoDBConnector({ client, dbName: 'test', handler: undefined }), command };
}

describe('MongoDB run fencing support', () => {
  it('rejects while the topology probe fails, then keeps the probed answer', async () => {
    const { connector, command } = stubbedConnector(async () => ({ setName: 'rs0' }));
    command.mockRejectedValueOnce(new Error('connection reset'));
    const workflows = new WorkflowsStorageMongoDB({ connector });
    const memory = new MemoryStorageMongoDB({ connector });

    await expect(workflows.supportsRunFencing()).rejects.toThrow('connection reset');
    await expect(workflows.supportsRunFencing()).resolves.toBe(true);
    await expect(memory.supportsRunFencing()).resolves.toBe(true);
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('declares no fencing on a standalone server', async () => {
    const { connector, command } = stubbedConnector(async () => ({ isWritablePrimary: true }));
    const workflows = new WorkflowsStorageMongoDB({ connector });

    await expect(workflows.supportsRunFencing()).resolves.toBe(false);
    await expect(workflows.supportsRunFencing()).resolves.toBe(false);
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('runs writes without a transaction while the probe fails', async () => {
    const { connector, command } = stubbedConnector(async () => ({ setName: 'rs0' }));
    command.mockRejectedValueOnce(new Error('connection reset'));

    await expect(connector.supportsTransactions()).resolves.toBe(false);
    await expect(connector.supportsTransactions()).resolves.toBe(true);
  });
});
