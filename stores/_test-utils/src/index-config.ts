import { describe, it, expect } from 'vitest';

/**
 * Configuration for store-level index tests
 */
export interface StoreIndexTestConfig {
  /** Name of the store being tested */
  storeName: string;

  /** Factory to create a default store (creates default indexes) */
  createDefaultStore: () => {
    init(): Promise<void>;
    close?(): Promise<void>;
  };

  /** Factory to create a store with skipDefaultIndexes: true */
  createStoreWithSkipDefaults: () => {
    init(): Promise<void>;
    close?(): Promise<void>;
  };

  /** Factory to create a store with custom indexes */
  createStoreWithCustomIndexes: (indexes: Array<{ name: string; [key: string]: unknown }>) => {
    init(): Promise<void>;
    close?(): Promise<void>;
  };

  /** Function to check if an index exists by name pattern */
  indexExists: (store: unknown, namePattern: string) => Promise<boolean>;

  /** Pattern to match default indexes (e.g., 'threads_resourceid') */
  defaultIndexPattern: string;

  /** Custom index name to use for testing */
  customIndexName: string;

  /** Custom index definition (store-specific format) */
  customIndexDef: { name: string; [key: string]: unknown };
}

/**
 * Creates tests for store-level index configuration.
 *
 * Tests that:
 * - Default indexes are created by default
 * - skipDefaultIndexes: true prevents default index creation
 * - Custom indexes are created when specified
 */
export function createStoreIndexTests(config: StoreIndexTestConfig) {
  const {
    storeName,
    createDefaultStore,
    createStoreWithSkipDefaults,
    createStoreWithCustomIndexes,
    indexExists,
    defaultIndexPattern,
    customIndexName,
    customIndexDef,
  } = config;

  describe(`${storeName} Index Configuration`, () => {
    it('should create default indexes by default', async () => {
      const store = createDefaultStore();
      try {
        await store.init();
        const exists = await indexExists(store, defaultIndexPattern);
        expect(exists, `Default index matching "${defaultIndexPattern}" should exist`).toBe(true);
      } finally {
        await store.close?.();
      }
    });

    it('should skip default indexes when skipDefaultIndexes is true', async () => {
      const store = createStoreWithSkipDefaults();
      try {
        await store.init();
        const exists = await indexExists(store, defaultIndexPattern);
        expect(exists, `Default index matching "${defaultIndexPattern}" should NOT exist`).toBe(false);
      } finally {
        await store.close?.();
      }
    });

    it('should create custom indexes when specified', async () => {
      const store = createStoreWithCustomIndexes([customIndexDef]);
      try {
        await store.init();
        const exists = await indexExists(store, customIndexName);
        expect(exists, `Custom index "${customIndexName}" should exist`).toBe(true);
      } finally {
        await store.close?.();
      }
    });
  });
}

/**
 * Configuration for domain-level index tests
 */
export interface DomainIndexTestConfig {
  /** Name of the domain being tested */
  domainName: string;

  /** Factory to create a default domain (creates default indexes) */
  createDefaultDomain: () => {
    init(): Promise<void>;
  };

  /** Factory to create a domain with skipDefaultIndexes: true */
  createDomainWithSkipDefaults: () => {
    init(): Promise<void>;
  };

  /** Factory to create a domain with custom indexes */
  createDomainWithCustomIndexes: (indexes: Array<{ name: string; [key: string]: unknown }>) => {
    init(): Promise<void>;
  };

  /** Function to check if an index exists by name pattern */
  indexExists: (domain: unknown, namePattern: string) => Promise<boolean>;

  /** Pattern to match default indexes (e.g., 'threads_resourceid') */
  defaultIndexPattern: string;

  /** Custom index name to use for testing */
  customIndexName: string;

  /** Custom index definition (domain-specific format) */
  customIndexDef: { name: string; [key: string]: unknown };
}

/**
 * Creates tests for domain-level index configuration.
 *
 * Tests that:
 * - Default indexes are created by default
 * - skipDefaultIndexes: true prevents default index creation
 * - Custom indexes are created when specified
 */
export function createDomainIndexTests(config: DomainIndexTestConfig) {
  const {
    domainName,
    createDefaultDomain,
    createDomainWithSkipDefaults,
    createDomainWithCustomIndexes,
    indexExists,
    defaultIndexPattern,
    customIndexName,
    customIndexDef,
  } = config;

  describe(`${domainName} Index Configuration`, () => {
    it('should create default indexes by default', async () => {
      const domain = createDefaultDomain();
      await domain.init();
      const exists = await indexExists(domain, defaultIndexPattern);
      expect(exists, `Default index matching "${defaultIndexPattern}" should exist`).toBe(true);
    });

    it('should skip default indexes when skipDefaultIndexes is true', async () => {
      const domain = createDomainWithSkipDefaults();
      await domain.init();
      const exists = await indexExists(domain, defaultIndexPattern);
      expect(exists, `Default index matching "${defaultIndexPattern}" should NOT exist`).toBe(false);
    });

    it('should create custom indexes when specified', async () => {
      const domain = createDomainWithCustomIndexes([customIndexDef]);
      await domain.init();
      const exists = await indexExists(domain, customIndexName);
      expect(exists, `Custom index "${customIndexName}" should exist`).toBe(true);
    });
  });
}
