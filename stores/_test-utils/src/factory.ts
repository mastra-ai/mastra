import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_TRACES,
  TABLE_SPANS,
} from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createOperationsTests } from './domains/operations';
import type { OperationsSkipTests } from './domains/operations';
import { createObservabilityTests } from './domains/observability';
export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/scores/data';
export * from './domains/observability/data';
export type { OperationsSkipTests } from './domains/operations';

/**
 * Options for createTestSuite to customize test execution
 */
export interface TestSuiteOptions {
  /**
   * Tests to skip in the operations module (index management, etc.)
   */
  skipOperationsTests?: OperationsSkipTests;
}

export function createTestSuite(storage: MastraStorage, options: TestSuiteOptions = {}) {
  describe(storage.constructor.name, () => {
    beforeAll(async () => {
      const start = Date.now();
      console.log('Initializing storage...');
      await storage.init();
      const end = Date.now();
      console.log(`Storage initialized in ${end - start}ms`);
    });

    afterAll(async () => {
      // Clear tables after tests
      // Note: Individual storage implementations handle retry logic internally
      await Promise.all([
        storage
          .clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT })
          .catch(e => console.warn(`clearTable failed for ${TABLE_WORKFLOW_SNAPSHOT}:`, e?.message)),
        storage
          .clearTable({ tableName: TABLE_MESSAGES })
          .catch(e => console.warn(`clearTable failed for ${TABLE_MESSAGES}:`, e?.message)),
        storage
          .clearTable({ tableName: TABLE_THREADS })
          .catch(e => console.warn(`clearTable failed for ${TABLE_THREADS}:`, e?.message)),
        storage
          .clearTable({ tableName: TABLE_RESOURCES })
          .catch(e => console.warn(`clearTable failed for ${TABLE_RESOURCES}:`, e?.message)),
        storage
          .clearTable({ tableName: TABLE_SCORERS })
          .catch(e => console.warn(`clearTable failed for ${TABLE_SCORERS}:`, e?.message)),
        storage
          .clearTable({ tableName: TABLE_TRACES })
          .catch(e => console.warn(`clearTable failed for ${TABLE_TRACES}:`, e?.message)),
        storage.supports.observabilityInstance &&
          storage
            .clearTable({ tableName: TABLE_SPANS })
            .catch(e => console.warn(`clearTable failed for ${TABLE_SPANS}:`, e?.message)),
      ]);
    });

    createOperationsTests({ storage, skipTests: options.skipOperationsTests });

    createWorkflowsTests({ storage });

    createMemoryTest({ storage });

    createScoresTest({ storage });

    if (storage.supports.observabilityInstance) {
      createObservabilityTests({ storage });
    }
  });
}
