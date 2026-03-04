import { resolve } from 'node:path';

import { MastraCompositeStore } from './base';
import type { StorageDomains } from './base';
import { FilesystemDB } from './filesystem-db';
import { FilesystemAgentsStorage } from './domains/agents/filesystem';
import { FilesystemPromptBlocksStorage } from './domains/prompt-blocks/filesystem';
import { FilesystemScorerDefinitionsStorage } from './domains/scorer-definitions/filesystem';
import { FilesystemMCPClientsStorage } from './domains/mcp-clients/filesystem';
import { FilesystemMCPServersStorage } from './domains/mcp-servers/filesystem';
import { FilesystemWorkspacesStorage } from './domains/workspaces/filesystem';
import { FilesystemSkillsStorage } from './domains/skills/filesystem';

export interface FilesystemStoreConfig {
  /**
   * Directory to store JSON files in.
   * Defaults to `.mastra-storage/` relative to `process.cwd()`.
   */
  dir?: string;
}

/**
 * Filesystem-based storage adapter for the Mastra Editor.
 *
 * Stores editor primitives (agents, prompt blocks, scorer definitions,
 * MCP clients, MCP servers, workspaces, skills) as JSON files on disk.
 * This enables Git-based version tracking instead of database-based versioning.
 *
 * Only implements the 7 editor domains — other domains (memory, workflows, scores,
 * observability, datasets, experiments, blobs) are left undefined and should be
 * provided by a separate store via the `editor` shorthand on `MastraCompositeStore`.
 *
 * @example
 * ```typescript
 * import { FilesystemStore, MastraCompositeStore } from '@mastra/core/storage';
 *
 * const storage = new MastraCompositeStore({
 *   id: 'my-storage',
 *   default: postgresStore,
 *   editor: new FilesystemStore({ dir: '.mastra-storage' }),
 * });
 * ```
 */
export class FilesystemStore extends MastraCompositeStore {
  #db: FilesystemDB;
  #dir: string;

  constructor(config: FilesystemStoreConfig = {}) {
    const dir = resolve(config.dir ?? '.mastra-storage');

    super({ id: 'filesystem', name: 'FilesystemStore' });

    this.#dir = dir;
    this.#db = new FilesystemDB(dir);

    // Only editor domains are provided; other domains (workflows, scores, memory, etc.)
    // should come from a default store when using the `editor` shorthand on MastraCompositeStore.
    this.stores = {
      agents: new FilesystemAgentsStorage({ db: this.#db }),
      promptBlocks: new FilesystemPromptBlocksStorage({ db: this.#db }),
      scorerDefinitions: new FilesystemScorerDefinitionsStorage({ db: this.#db }),
      mcpClients: new FilesystemMCPClientsStorage({ db: this.#db }),
      mcpServers: new FilesystemMCPServersStorage({ db: this.#db }),
      workspaces: new FilesystemWorkspacesStorage({ db: this.#db }),
      skills: new FilesystemSkillsStorage({ db: this.#db }),
    } as unknown as StorageDomains;
  }

  /**
   * The absolute path to the storage directory.
   */
  get dir(): string {
    return this.#dir;
  }
}
