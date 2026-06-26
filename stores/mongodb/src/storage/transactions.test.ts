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
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-standalone', url: STANDALONE_URI, dbName: DB });
    try {
      expect(await connector.supportsTransactions()).toBe(false);
    } finally {
      await connector.close();
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

  test('deleteThread rolls back message deletion when the thread delete fails (replica set)', async () => {
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

    // Make the thread deleteOne fail AFTER the messages deleteMany runs inside the transaction.
    const spy = vi.spyOn(Collection.prototype, 'deleteOne').mockRejectedValueOnce(new Error('thread delete boom'));
    try {
      await expect(memory?.deleteThread({ threadId })).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }

    // Transaction aborted, so the messages must still be present.
    const client = new MongoClient(REPLICA_SET_URI);
    try {
      await client.connect();
      const remaining = await client.db(DB).collection('mastra_messages').countDocuments({ thread_id: threadId });
      expect(remaining).toBe(1);
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
});
