import { describe, expect, it } from 'vitest';
import { MongoDBConnector } from './connectors/MongoDBConnector';

const STANDALONE_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REPLICA_SET_URI =
  process.env.MONGODB_RS_URL ||
  'mongodb://mongodb:mongodb@localhost:27018/?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000';
const DB = 'mastra-hardening-tx';

describe('Hardening: NODE-7556 — transactions (Tranche B)', () => {
  it('B1: supportsTransactions() is false on a standalone server', async () => {
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-standalone', url: STANDALONE_URI, dbName: DB });
    try {
      expect(await connector.supportsTransactions()).toBe(false);
    } finally {
      await connector.close();
    }
  });

  it('B1: supportsTransactions() is true on a replica set', async () => {
    const connector = MongoDBConnector.fromDatabaseConfig({ id: 'tx-rs', url: REPLICA_SET_URI, dbName: DB });
    try {
      expect(await connector.supportsTransactions()).toBe(true);
    } finally {
      await connector.close();
    }
  });

  it('B1: withTransaction rolls back all writes when the callback throws (replica set)', async () => {
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

  it('B1: withTransaction degrades on standalone — write persists, error still propagates', async () => {
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
});
