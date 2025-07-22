import { createTestSuite } from '@internal/storage-test-utils';
import { describe, expect, it } from 'vitest';
import type { ConnectorHandler } from './connectors/base';
import type { MongoDBConfig } from './types';
import { MongoDBStore } from './index';

const TEST_CONFIG: MongoDBConfig = {
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-test-db',
};

describe('Validation', () => {
  describe('with database options', () => {
    const validConfig = TEST_CONFIG;
    it('throws if url is empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, url: '' })).toThrow(/url must be provided and cannot be empty/);
    });

    it('throws if dbName is missing or empty', () => {
      expect(() => new MongoDBStore({ ...validConfig, dbName: '' })).toThrow(
        /dbName must be provided and cannot be empty/,
      );
      const { dbName, ...rest } = validConfig;
      expect(() => new MongoDBStore(rest as any)).toThrow(/dbName must be provided and cannot be empty/);
    });

    it('does not throw on valid config (host-based)', () => {
      expect(() => new MongoDBStore(validConfig)).not.toThrow();
    });
  });

  describe('with connection handler', () => {
    const validWithConnectionHandlerConfig = {
      connectorHandler: {} as ConnectorHandler,
    };

    it('not throws if url is empty', () => {
      expect(() => new MongoDBStore({ ...validWithConnectionHandlerConfig, url: '' })).not.toThrow(
        /url must be provided and cannot be empty/,
      );
    });

    it('not throws if dbName is missing or empty', () => {
      expect(() => new MongoDBStore({ ...validWithConnectionHandlerConfig, dbName: '' })).not.toThrow(
        /dbName must be provided and cannot be empty/,
      );
      const { dbName, ...rest } = validWithConnectionHandlerConfig as any;
      expect(() => new MongoDBStore(rest as any)).not.toThrow(/dbName must be provided and cannot be empty/);
    });

    it('does not throw on valid config', () => {
      expect(() => new MongoDBStore(validWithConnectionHandlerConfig)).not.toThrow();
    });
  });
});

createTestSuite(new MongoDBStore(TEST_CONFIG));
