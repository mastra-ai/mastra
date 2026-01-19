import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const dbFile = 'file:storage-init-test.db';
const files = ['storage-init-test.db', 'storage-init-test.db-shm', 'storage-init-test.db-wal'];

/**
 * Custom LibSQL storage that tracks init calls on each domain.
 * This helps verify that domain init() is only called once.
 */
class TrackingLibSQLStore extends LibSQLStore {
  // Track init calls on each domain
  memoryInitCount = 0;
  workflowsInitCount = 0;
  scoresInitCount = 0;
  observabilityInitCount = 0;
  agentsInitCount = 0;
  storageInitCount = 0;
  getStoreCount = 0;

  constructor(config: { id: string; url: string }) {
    super(config);

    // Wrap each domain's init method to track calls
    const memoryStore = this.stores.memory;
    const originalMemoryInit = memoryStore.init.bind(memoryStore);
    memoryStore.init = async () => {
      this.memoryInitCount++;
      return originalMemoryInit();
    };

    const workflowsStore = this.stores.workflows;
    const originalWorkflowsInit = workflowsStore.init.bind(workflowsStore);
    workflowsStore.init = async () => {
      this.workflowsInitCount++;
      return originalWorkflowsInit();
    };

    const scoresStore = this.stores.scores;
    const originalScoresInit = scoresStore.init.bind(scoresStore);
    scoresStore.init = async () => {
      this.scoresInitCount++;
      return originalScoresInit();
    };

    const observabilityStore = this.stores.observability;
    const originalObservabilityInit = observabilityStore.init.bind(observabilityStore);
    observabilityStore.init = async () => {
      this.observabilityInitCount++;
      return originalObservabilityInit();
    };

    const agentsStore = this.stores.agents;
    const originalAgentsInit = agentsStore.init.bind(agentsStore);
    agentsStore.init = async () => {
      this.agentsInitCount++;
      return originalAgentsInit();
    };
  }

  override async init(): Promise<void> {
    this.storageInitCount++;
    return super.init();
  }

  override async getStore<K extends keyof import('@mastra/core/storage').StorageDomains>(
    storeName: K,
  ): Promise<import('@mastra/core/storage').StorageDomains[K] | undefined> {
    this.getStoreCount++;
    return super.getStore(storeName);
  }
}

// Simple mock model for testing
function createMockModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-model',
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text: 'Hello! How can I help you?' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'response-1',
            modelId: 'mock-model',
            timestamp: new Date(0),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Hello!' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      }),
    }),
  };
}

describe('Storage domain init during agent.stream with LibSQL', () => {
  beforeEach(() => {
    // Clean up any existing db files before each test
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  afterAll(() => {
    // Clean up db files
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  it('should only call domain init() once even when init() is called explicitly before other methods', async () => {
    // This test reproduces the scenario where:
    // 1. mastra.getStorage().init() is called explicitly (e.g., in CLI build)
    // 2. Later, getStore() or other methods are called
    // The proxy's ensureInit() should recognize that init was already called

    const trackingStorage = new TrackingLibSQLStore({
      id: 'tracking-storage-explicit-init',
      url: dbFile,
    });

    const mastra = new Mastra({
      storage: trackingStorage,
    });

    // Get the augmented storage (proxy) from Mastra
    const augmentedStorage = mastra.getStorage()!;

    // Simulate what the CLI build does: call init() explicitly on the proxy
    await augmentedStorage.init();

    // Now call getStore() which should NOT call init() again
    await augmentedStorage.getStore('memory');
    await augmentedStorage.getStore('workflows');
    await augmentedStorage.getStore('memory');

    // Domain init should only be called once (from the explicit init call)
    console.log('Explicit init then getStore - Counts:', {
      storageInit: trackingStorage.storageInitCount,
      memoryInit: trackingStorage.memoryInitCount,
      workflowsInit: trackingStorage.workflowsInitCount,
    });

    expect(trackingStorage.memoryInitCount).toBe(1);
    expect(trackingStorage.workflowsInitCount).toBe(1);
  });

  it('should only call domain init() once when memory inherits storage from Mastra and streams multiple times', async () => {
    const trackingStorage = new TrackingLibSQLStore({
      id: 'tracking-storage',
      url: dbFile,
    });

    // Create memory WITHOUT its own storage - it will inherit from Mastra
    // Enable working memory to match user's scenario
    const memory = new Memory({
      options: {
        lastMessages: 10,
        workingMemory: {
          enabled: true,
        },
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createMockModel() as any,
      memory,
    });

    // Register agent with Mastra so memory inherits storage
    new Mastra({
      storage: trackingStorage,
      agents: { 'test-agent': agent },
    });

    const threadId = randomUUID();
    const resourceId = 'test-user';

    // Stream multiple times with memory enabled
    for (let i = 0; i < 3; i++) {
      const response = await agent.stream(`Message ${i}`, {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });
      await response.consumeStream();
    }

    // Log the counts for debugging
    console.log('Sequential streams (3 messages) - Counts:', {
      storageInit: trackingStorage.storageInitCount,
      memoryInit: trackingStorage.memoryInitCount,
      workflowsInit: trackingStorage.workflowsInitCount,
      scoresInit: trackingStorage.scoresInitCount,
      getStoreCalls: trackingStorage.getStoreCount,
    });

    // Each domain's init() should only be called once despite multiple streams
    expect(trackingStorage.memoryInitCount).toBe(1);
    expect(trackingStorage.workflowsInitCount).toBe(1);
    expect(trackingStorage.scoresInitCount).toBe(1);
  });

  it('should only call domain init() once with concurrent stream calls when memory inherits storage', async () => {
    const trackingStorage = new TrackingLibSQLStore({
      id: 'tracking-storage-concurrent',
      url: dbFile,
    });

    // Create memory WITHOUT its own storage
    // Enable working memory to match user's scenario
    const memory = new Memory({
      options: {
        lastMessages: 10,
        workingMemory: {
          enabled: true,
        },
      },
    });

    const agent = new Agent({
      id: 'test-agent-concurrent',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createMockModel() as any,
      memory,
    });

    // Register agent with Mastra
    new Mastra({
      storage: trackingStorage,
      agents: { 'test-agent': agent },
    });

    const resourceId = 'test-user';

    // Fire multiple concurrent stream calls (different threads but same storage)
    const streams = await Promise.all([
      agent.stream('Message 1', {
        memory: { thread: randomUUID(), resource: resourceId },
      }),
      agent.stream('Message 2', {
        memory: { thread: randomUUID(), resource: resourceId },
      }),
      agent.stream('Message 3', {
        memory: { thread: randomUUID(), resource: resourceId },
      }),
    ]);

    // Consume all streams
    await Promise.all(streams.map(s => s.consumeStream()));

    // Log the counts for debugging
    console.log('Concurrent streams - Init counts:', {
      storage: trackingStorage.storageInitCount,
      memory: trackingStorage.memoryInitCount,
      workflows: trackingStorage.workflowsInitCount,
      scores: trackingStorage.scoresInitCount,
      getStore: trackingStorage.getStoreCount,
    });

    // Each domain's init() should only be called once despite concurrent streams
    expect(trackingStorage.memoryInitCount).toBe(1);
    expect(trackingStorage.workflowsInitCount).toBe(1);
    expect(trackingStorage.scoresInitCount).toBe(1);
  });
});
