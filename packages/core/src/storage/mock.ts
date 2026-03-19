import { MastraCompositeStore } from './base';
import type { StorageDomains } from './base';
import { InMemoryAgentsStorage } from './domains/agents/inmemory';
import { InMemoryBlobStore } from './domains/blobs/inmemory';
import { DatasetsInMemory } from './domains/datasets/inmemory';
import { ExperimentsInMemory } from './domains/experiments/inmemory';
import { InMemoryDB } from './domains/inmemory-db';
import { InMemoryMCPClientsStorage } from './domains/mcp-clients/inmemory';
import { InMemoryMCPServersStorage } from './domains/mcp-servers/inmemory';
import { InMemoryMemory } from './domains/memory/inmemory';
import { ObservabilityInMemory } from './domains/observability/inmemory';
import { InMemoryPromptBlocksStorage } from './domains/prompt-blocks/inmemory';
import { InMemoryScorerDefinitionsStorage } from './domains/scorer-definitions/inmemory';
import { ScoresInMemory } from './domains/scores/inmemory';
import { InMemorySkillsStorage } from './domains/skills/inmemory';
import { WorkflowsInMemory } from './domains/workflows/inmemory';
import { InMemoryWorkspacesStorage } from './domains/workspaces/inmemory';
/**
 * In-memory storage implementation for testing and development.
 *
 * All data is stored in memory and will be lost when the process ends.
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new InMemoryStore();
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 */
export class InMemoryStore extends MastraCompositeStore {
  stores: StorageDomains;

  /**
   * Internal database layer shared across all domains.
   * This is an implementation detail - domains interact with this
   * rather than managing their own data structures.
   */
  #db: InMemoryDB;

  constructor({ id = 'in-memory' }: { id?: string } = {}) {
    super({ id, name: 'InMemoryStorage' });
    // InMemoryStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    // Create internal db layer - shared across all domains
    this.#db = new InMemoryDB();

    // Create all domain instances with the shared db
    this.stores = {
      memory: new InMemoryMemory({ db: this.#db }),
      workflows: new WorkflowsInMemory({ db: this.#db }),
      scores: new ScoresInMemory({ db: this.#db }),
      observability: new ObservabilityInMemory({ db: this.#db }),
      agents: new InMemoryAgentsStorage({ db: this.#db }),
      datasets: new DatasetsInMemory({ db: this.#db }),
      experiments: new ExperimentsInMemory({ db: this.#db }),
      promptBlocks: new InMemoryPromptBlocksStorage({ db: this.#db }),
      scorerDefinitions: new InMemoryScorerDefinitionsStorage({ db: this.#db }),
      mcpClients: new InMemoryMCPClientsStorage({ db: this.#db }),
      mcpServers: new InMemoryMCPServersStorage({ db: this.#db }),
      workspaces: new InMemoryWorkspacesStorage({ db: this.#db }),
      skills: new InMemorySkillsStorage({ db: this.#db }),
      blobs: new InMemoryBlobStore(),
    };
  }

  /**
   * Clears all data from the in-memory database.
   * Useful for testing.
   * @deprecated Use dangerouslyClearAll() on individual domains instead.
   */
  clear(): void {
    this.#db.clear();
  }
}

export const MockStore = InMemoryStore;
