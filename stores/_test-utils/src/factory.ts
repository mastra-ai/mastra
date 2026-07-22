import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createObservabilityTests } from './domains/observability';
import { createAgentsTests } from './domains/agents';
import { createDatasetsTests } from './domains/datasets';
import { createBackgroundTasksTests } from './domains/background-tasks';
import { createExperimentsTests } from './domains/experiments';
import { createFavoritesTests } from './domains/favorites';
import { createSchedulesTests } from './domains/schedules';
import { createChannelsTests } from './domains/channels';
import { createToolProviderConnectionsTests } from './domains/tool-provider-connections';
import { createSkillsTests } from './domains/skills';
export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/scores/data';
export * from './domains/observability/data';
export * from './domains/agents/data';
export * from './domains/datasets/data';
export * from './domains/experiments/data';
export * from './domains/background-tasks/data';
export * from './domains/schedules/data';
export * from './domains/channels/data';
export * from './domains/tool-provider-connections/data';

/**
 * Test-specific feature flags for conditionally enabling test scenarios.
 * Unlike storage domain availability (checked via storage.stores), these flags
 * control whether specific operations within a domain are tested.
 */
export type TestCapabilities = {
  /** Whether the adapter supports listing scores by span (defaults to true) */
  listScoresBySpan?: boolean;
  /** Whether scorer-based pagination is guaranteed to be ordered newest-first. */
  deterministicScorePagination?: boolean;
  /**
   * Whether the adapter persists item-level tool mocks and experiment tool mock
   * reports (defaults to true). Adapters that reject them (e.g. MySQL) set this
   * to false so the round-trip suite asserts rejection instead of persistence.
   */
  toolMocks?: boolean;
  /** Whether the adapter persists dataset item timeout overrides (defaults to true). */
  datasetItemTimeout?: boolean;
  /** Whether identity-aware dataset item insertion is supported (defaults to true). */
  datasetItemIdentity?: boolean;
};

export function createTestSuite(storage: MastraStorage, capabilities: TestCapabilities = {}) {
  describe(storage.constructor.name, () => {
    beforeAll(async () => {
      const start = Date.now();
      console.log('Initializing storage...');
      await storage.init();
      const end = Date.now();
      console.log(`Storage initialized in ${end - start}ms`);
    });

    afterAll(async () => {
      const clearList: Promise<void>[] = [];

      const workflowStorage = await storage.getStore('workflows');
      const memoryStorage = await storage.getStore('memory');
      const scoresStorage = await storage.getStore('scores');
      const observabilityStorage = await storage.getStore('observability');
      const agentsStorage = await storage.getStore('agents');

      if (workflowStorage) {
        clearList.push(workflowStorage.dangerouslyClearAll());
      }
      if (memoryStorage) {
        clearList.push(memoryStorage.dangerouslyClearAll());
      }
      if (scoresStorage) {
        clearList.push(scoresStorage.dangerouslyClearAll());
      }
      if (observabilityStorage) {
        clearList.push(observabilityStorage.dangerouslyClearAll());
      }
      if (agentsStorage) {
        clearList.push(agentsStorage.dangerouslyClearAll());
      }

      const datasetsStorage = await storage.getStore('datasets');
      const experimentsStorage = await storage.getStore('experiments');

      if (datasetsStorage) {
        clearList.push(datasetsStorage.dangerouslyClearAll());
      }
      if (experimentsStorage) {
        clearList.push(experimentsStorage.dangerouslyClearAll());
      }

      const backgroundTasksStorage = await storage.getStore('backgroundTasks');
      if (backgroundTasksStorage) {
        clearList.push(backgroundTasksStorage.dangerouslyClearAll());
      }

      const favoritesStorage = await storage.getStore('favorites');
      if (favoritesStorage) {
        clearList.push(favoritesStorage.dangerouslyClearAll());
      }

      const schedulesStorage = await storage.getStore('schedules');
      if (schedulesStorage) {
        clearList.push(schedulesStorage.dangerouslyClearAll());
      }

      const channelsStorage = await storage.getStore('channels');
      if (channelsStorage) {
        clearList.push(channelsStorage.dangerouslyClearAll());
      }

      const toolProviderConnectionsStorage = await storage.getStore('toolProviderConnections');
      if (toolProviderConnectionsStorage) {
        clearList.push(toolProviderConnectionsStorage.dangerouslyClearAll());
      }

      // Clear all domain data after tests
      await Promise.all(clearList);
    });

    // Tests are registered unconditionally - each test internally handles
    // checking if the storage domain is available
    createWorkflowsTests({ storage });
    createMemoryTest({ storage });
    createScoresTest({ storage, capabilities });
    createObservabilityTests({ storage });
    createAgentsTests({ storage });
    createDatasetsTests({ storage, capabilities });
    createExperimentsTests({ storage, capabilities });
    createBackgroundTasksTests({ storage });
    createFavoritesTests({ storage });
    createSkillsTests({ storage });
    createSchedulesTests({ storage });
    createChannelsTests({ storage });
    createToolProviderConnectionsTests({ storage });
  });
}
