import { Collection, MongoClient } from 'mongodb';
import { describe, expect, test, vi } from 'vitest';
import { MongoDBConnector } from './connectors/MongoDBConnector';
import { MongoDBStore } from './index';

const STANDALONE_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REPLICA_SET_URI =
  process.env.MONGODB_RS_URL ||
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
const DB = 'mastra-transactions-test';

describe('MongoDB storage — topology-aware transactions', () => {
  test('supportsTransactions() returns false on a standalone server', async () => {
    const client = new MongoClient(STANDALONE_URI);
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-standalone', url: STANDALONE_URI, dbName: DB });
    try {
      await client.connect();
      const hello = await client.db(DB).admin().command({ hello: 1 });
      expect(Boolean(hello.setName) || hello.msg === 'isdbgrid').toBe(false);
      expect(await connector.supportsTransactions()).toBe(false);
    } finally {
      await client.close();
      await connector.close();
    }
  });

  test('identity-aware dataset item writes fail before mutation on standalone MongoDB', async () => {
    const store = new MongoDBStore({ id: 'tx-identity-standalone', uri: STANDALONE_URI, dbName: DB });
    try {
      await store.init();
      const datasets = await store.getStore('datasets');
      if (!datasets) throw new Error('Datasets storage not found');
      await datasets.dangerouslyClearAll();
      const dataset = await datasets.createDataset({ name: 'identity-standalone' });

      await expect(
        datasets.batchInsertItems({
          datasetId: dataset.id,
          items: [{ externalId: 'item-1', input: { value: 'same' } }],
        }),
      ).rejects.toMatchObject({ id: 'DATASET_ITEM_IDENTITY_REQUIRES_TRANSACTIONS' });

      expect((await datasets.getDatasetById({ id: dataset.id }))!.version).toBe(0);
      expect((await datasets.listItems({ datasetId: dataset.id, pagination: { page: 0, perPage: 10 } })).items).toEqual(
        [],
      );
    } finally {
      await store.close();
    }
  });

  test('supportsTransactions() returns true on a replica set', async () => {
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-rs', url: REPLICA_SET_URI, dbName: DB });
    try {
      expect(await connector.supportsTransactions()).toBe(true);
    } finally {
      await connector.close();
    }
  });

  test('withTransaction rolls back all writes when the callback throws (replica set)', async () => {
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-rollback', url: REPLICA_SET_URI, dbName: DB });
    try {
      const col = await connector.getCollection('tx_probe');
      await col.deleteMany({});
      await expect(
        connector.withTransaction(async session => {
          await col.insertOne({ marker: 'rollback' }, { session });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await col.countDocuments({})).toBe(0);
    } finally {
      await connector.close();
    }
  });

  test('withTransaction degrades gracefully on standalone: writes persist and errors still propagate', async () => {
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-degrade', url: STANDALONE_URI, dbName: DB });
    try {
      const col = await connector.getCollection('tx_probe');
      await col.deleteMany({});
      await expect(
        connector.withTransaction(async session => {
          await col.insertOne({ marker: 'degrade' }, { session });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await col.countDocuments({})).toBe(1);
    } finally {
      await connector.close();
    }
  });

  test('deleteThread cascades best-effort (no rollback) and recovers via idempotent retry (replica set)', async () => {
    // deleteThread is deliberately NOT transactional: a thread's messages are
    // unbounded and a transactional deleteMany would be capped by the 60s
    // transaction lifetime limit. Instead it drains messages first, then deletes
    // the thread row last as the linearization point. This verifies that when the
    // final thread delete fails, the message deletion is NOT rolled back, the
    // thread row survives (re-deletable), and a retry completes the cascade.
    const store = new MongoDBStore({ id: 'tx-delete-thread', uri: REPLICA_SET_URI, dbName: DB });
    await store.init();
    const memory = await store.getStore('memory');

    const threadId = `thr-b2-${Date.now()}`;
    const resourceId = `res-b2-${Date.now()}`;
    await memory?.saveThread({
      thread: { id: threadId, resourceId, title: 't', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
    });
    await memory?.saveMessages({
      messages: [
        {
          id: `m-b2-${Date.now()}`,
          threadId,
          resourceId,
          role: 'user',
          type: 'v2',
          content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
        } as any,
      ],
    });

    // Make the thread deleteOne fail AFTER the messages deleteMany has run.
    const spy = vi.spyOn(Collection.prototype, 'deleteOne').mockRejectedValueOnce(new Error('thread delete boom'));
    try {
      await expect(memory?.deleteThread({ threadId })).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }

    const client = new MongoClient(REPLICA_SET_URI);
    try {
      await client.connect();
      const db = client.db(DB);

      // No rollback: messages were drained before the thread delete failed.
      const remainingMessages = await db.collection('mastra_messages').countDocuments({ thread_id: threadId });
      expect(remainingMessages).toBe(0);
      // The thread row survives — the failed delete left a recoverable state.
      const remainingThreads = await db.collection('mastra_threads').countDocuments({ id: threadId });
      expect(remainingThreads).toBe(1);

      // Idempotent retry completes the cascade with no spy in place.
      await memory?.deleteThread({ threadId });
      const threadsAfterRetry = await db.collection('mastra_threads').countDocuments({ id: threadId });
      expect(threadsAfterRetry).toBe(0);
    } finally {
      await client.close();
      await store.close();
    }
  });

  test('saveMessages rolls back the message write when the thread timestamp update fails (replica set)', async () => {
    const store = new MongoDBStore({ id: 'tx-save-messages', uri: REPLICA_SET_URI, dbName: DB });
    await store.init();
    const memory = await store.getStore('memory');

    const threadId = `thr-b3-${Date.now()}`;
    const resourceId = `res-b3-${Date.now()}`;
    await memory?.saveThread({
      thread: { id: threadId, resourceId, title: 't', metadata: {}, createdAt: new Date(), updatedAt: new Date() },
    });

    const messageId = `m-b3-${Date.now()}`;
    // Throw on the next updateOne (the thread updatedAt write inside saveMessages).
    // bulkWrite is a different method, so the message insert itself is not stubbed.
    const spy = vi.spyOn(Collection.prototype, 'updateOne').mockRejectedValueOnce(new Error('updatedAt boom'));
    try {
      await expect(
        memory?.saveMessages({
          messages: [
            {
              id: messageId,
              threadId,
              resourceId,
              role: 'user',
              type: 'v2',
              content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
            } as any,
          ],
        }),
      ).rejects.toThrow();
      // The failure must come from the thread updatedAt updateOne (called once), not anything else.
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }

    const client = new MongoClient(REPLICA_SET_URI);
    try {
      await client.connect();
      const saved = await client.db(DB).collection('mastra_messages').countDocuments({ id: messageId });
      expect(saved).toBe(0); // message write rolled back
    } finally {
      await client.close();
      await store.close();
    }
  });

  test('agents.create() rolls back the agent insert when version insert fails (replica set)', async () => {
    const store = new MongoDBStore({ id: 'tx-agents-create', uri: REPLICA_SET_URI, dbName: DB });
    await store.init();
    const agents = await store.getStore('agents');

    const agentId = `agent-create-tx-${Date.now()}`;

    // The transaction calls insertOne twice: first for the agent row, second for the version row.
    // Make the second call throw so the transaction aborts after the agent row is staged.
    let callCount = 0;
    const original = Collection.prototype.insertOne;
    const spy = vi.spyOn(Collection.prototype, 'insertOne').mockImplementation(async function (
      this: Collection<any>,
      ...args: Parameters<typeof original>
    ) {
      callCount++;
      if (callCount >= 2) throw new Error('version insert boom');
      return original.apply(this, args);
    });

    try {
      await expect(
        agents?.create({
          agent: {
            id: agentId,
            name: 'Test Agent',
            instructions: 'test',
            model: { provider: 'ANTHROPIC', toolChoice: 'auto', name: 'claude-sonnet-4-6' },
          } as any,
        }),
      ).rejects.toThrow('version insert boom');
    } finally {
      spy.mockRestore();
    }

    // Transaction rolled back — agent row must not exist.
    const client = new MongoClient(REPLICA_SET_URI);
    try {
      await client.connect();
      const count = await client.db(DB).collection('mastra_agents').countDocuments({ id: agentId });
      expect(count).toBe(0);
    } finally {
      await client.close();
      await store.close();
    }
  });

  test('agents.delete() rolls back version deletion when agent deleteOne fails (replica set)', async () => {
    const store = new MongoDBStore({ id: 'tx-agents-delete', uri: REPLICA_SET_URI, dbName: DB });
    await store.init();
    const agents = await store.getStore('agents');

    const agentId = `agent-del-tx-${Date.now()}`;

    // Create the agent first (no spy — let this succeed).
    await agents?.create({
      agent: {
        id: agentId,
        name: 'To Delete',
        instructions: 'test',
        model: { provider: 'ANTHROPIC', toolChoice: 'auto', name: 'claude-sonnet-4-6' },
      } as any,
    });

    // delete() runs deleteMany(versions) then deleteOne(agent) inside a transaction.
    // Make deleteOne fail so the transaction aborts after versions have been staged for deletion.
    const spy = vi.spyOn(Collection.prototype, 'deleteOne').mockRejectedValueOnce(new Error('agent delete boom'));
    try {
      await expect(agents?.delete(agentId)).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }

    // Transaction rolled back — versions must still exist.
    const client = new MongoClient(REPLICA_SET_URI);
    try {
      await client.connect();
      const vCount = await client.db(DB).collection('mastra_agent_versions').countDocuments({ agentId });
      expect(vCount).toBeGreaterThan(0);
    } finally {
      await client.close();
      await store.close();
    }
  });
});
