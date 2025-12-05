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
  TABLE_AGENTS,
} from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createOperationsTests } from './domains/operations';
import type { OperationsSkipTests } from './domains/operations';
import { createObservabilityTests } from './domains/observability';
import { createAgentsTests } from './domains/agents';
export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/scores/data';
export * from './domains/observability/data';
export * from './domains/agents/data';

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
        storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT }),
        storage.clearTable({ tableName: TABLE_MESSAGES }),
        storage.clearTable({ tableName: TABLE_THREADS }),
        storage.clearTable({ tableName: TABLE_RESOURCES }),
        storage.clearTable({ tableName: TABLE_SCORERS }),
        storage.clearTable({ tableName: TABLE_TRACES }),
        storage.supports.observabilityInstance && storage.clearTable({ tableName: TABLE_SPANS }),
        storage.supports.agents && storage.clearTable({ tableName: TABLE_AGENTS }),
      ]);
    });

    createOperationsTests({ storage, skipTests: options.skipOperationsTests });

    createWorkflowsTests({ storage });

    createMemoryTest({ storage });

    createScoresTest({ storage });

    if (storage.supports.observabilityInstance) {
      createObservabilityTests({ storage });
    }

    // Agents tests are conditionally run based on storage.supports.agents inside the test suite
    createAgentsTests({ storage });
  });
}
