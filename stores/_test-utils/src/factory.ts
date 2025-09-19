import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_TRACES,
  TABLE_AI_SPANS,
} from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createTraceTests } from './domains/traces';
import { createEvalsTests } from './domains/evals';
import { createOperationsTests } from './domains/operations';
import { createObservabilityTests } from './domains/observability';
export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/evals/data';
export * from './domains/scores/data';
export * from './domains/traces/data';
export * from './domains/observability/data';

export function createTestSuite(storage: MastraStorage) {
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
      await Promise.all([
        storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT }),
        storage.clearTable({ tableName: TABLE_EVALS }),
        storage.clearTable({ tableName: TABLE_MESSAGES }),
        storage.clearTable({ tableName: TABLE_THREADS }),
        storage.clearTable({ tableName: TABLE_RESOURCES }),
        storage.clearTable({ tableName: TABLE_SCORERS }),
        storage.clearTable({ tableName: TABLE_TRACES }),
        storage.supports.aiTracing && storage.clearTable({ tableName: TABLE_AI_SPANS }),
      ]);
    });

    createOperationsTests({ storage });

    createWorkflowsTests({ storage });

    createTraceTests({ storage });

    createEvalsTests({ storage });

    createMemoryTest({ storage });

    createScoresTest({ storage });

    if (storage.supports.aiTracing) {
      createObservabilityTests({ storage });
    }
  });
}
