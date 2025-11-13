import { MastraStorage } from './base';
import { EvalsStorageInMemory } from './domains/evals/inmemory';
import { MemoryStorageInMemory } from './domains/memory/inmemory';
import { ObservabilityStorageInMemory } from './domains/observability/inmemory';
import { WorkflowsStorageInMemory } from './domains/workflows/inmemory';
export class InMemoryStore extends MastraStorage {
  constructor({ id = 'in-memory' }: { id?: string } = {}) {
    super({ id, name: 'InMemoryStorage' });
    // MockStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    const evalsStorage = new EvalsStorageInMemory();

    const workflowsStorage = new WorkflowsStorageInMemory();

    const memoryStorage = new MemoryStorageInMemory();

    const observabilityStorage = new ObservabilityStorageInMemory();

    this.stores = {
      workflows: workflowsStorage,
      evals: evalsStorage,
      memory: memoryStorage,
      observability: observabilityStorage,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      observabilityInstance: true,
      indexManagement: false,
      listScoresBySpan: true,
    };
  }
}
