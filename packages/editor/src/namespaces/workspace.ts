import { Workspace } from '@mastra/core/workspace';
import type { WorkspaceFilesystem, WorkspaceSandbox, SkillSource } from '@mastra/core/workspace';
import type { WorkspaceConfig } from '@mastra/core/workspace';
import type {
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  StorageResolvedWorkspaceType,
  StorageListWorkspacesResolvedOutput,
  StorageWorkspaceSnapshotType,
  StorageFilesystemConfig,
  StorageSandboxConfig,
} from '@mastra/core/storage';

import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

export class EditorWorkspaceNamespace extends CrudEditorNamespace<
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  StorageListWorkspacesResolvedOutput,
  StorageResolvedWorkspaceType,
  StorageResolvedWorkspaceType
> {
  protected override onCacheEvict(_id: string): void {
    // Workspaces are not registered in Mastra runtime from the CRUD namespace.
    // Agent hydration handles runtime workspace registration independently.
  }

  /**
   * Hydrate a stored workspace snapshot config into a runtime Workspace instance.
   * Resolves provider strings to actual instances using the editor's registries.
   *
   * This is NOT called from the CrudEditorNamespace flow — it is a public utility
   * used by EditorAgentNamespace during agent hydration.
   */
  async hydrateSnapshotToWorkspace(
    id: string,
    snapshot: StorageWorkspaceSnapshotType,
    options?: { skillSource?: SkillSource },
  ): Promise<
    Workspace<
      WorkspaceFilesystem | undefined,
      WorkspaceSandbox | undefined,
      Record<string, WorkspaceFilesystem> | undefined
    >
  > {
    const config: WorkspaceConfig<
      WorkspaceFilesystem | undefined,
      WorkspaceSandbox | undefined,
      Record<string, WorkspaceFilesystem> | undefined
    > = {
      id,
      name: snapshot.name,
    };

    // Resolve primary filesystem
    if (snapshot.filesystem) {
      config.filesystem = await this.resolveFilesystem(snapshot.filesystem);
    }

    // Resolve sandbox
    if (snapshot.sandbox) {
      config.sandbox = await this.resolveSandbox(snapshot.sandbox);
    }

    // Resolve mounted filesystems
    if (snapshot.mounts) {
      const mounts: Record<string, WorkspaceFilesystem> = {};
      for (const [path, fsConfig] of Object.entries(snapshot.mounts)) {
        mounts[path] = await this.resolveFilesystem(fsConfig);
      }
      config.mounts = mounts;
    }

    // Search configuration
    if (snapshot.search) {
      if (snapshot.search.bm25) {
        config.bm25 = snapshot.search.bm25;
      }
      if (snapshot.search.searchIndexName) {
        config.searchIndexName = snapshot.search.searchIndexName;
      }
      if (snapshot.search.autoIndexPaths) {
        config.autoIndexPaths = snapshot.search.autoIndexPaths;
      }

      // Resolve vector store from Mastra's registered vectors
      if (snapshot.search.vectorProvider && this.mastra) {
        const vectors = this.mastra.listVectors();
        const vectorStore = vectors?.[snapshot.search.vectorProvider];
        if (vectorStore) {
          config.vectorStore = vectorStore;
        } else {
          this.logger?.warn(
            `Vector provider "${snapshot.search.vectorProvider}" not found in Mastra instance. ` +
              `Workspace search will be limited to BM25 only.`,
          );
        }
      }

      // Embedder resolution: workspace expects an Embedder function (text: string) => Promise<number[]>.
      // The stored config has embedderProvider/embedderModel strings but there is no embedder registry
      // in Mastra yet. For now, skip — BM25-only search works without an embedder.
      // Vector search requires both vectorStore and embedder to be configured.
      if (config.vectorStore && !config.embedder) {
        this.logger?.warn(
          `Workspace has a vector store configured but no embedder. ` +
            `Vector/hybrid search will not be available. Configure an embedder to enable semantic search.`,
        );
      }
    }

    // Skills are stored as entity IDs in the workspace config.
    // When a versioned skill source is provided (from agent-level resolution),
    // it takes precedence — skills are served from the blob store.
    // Otherwise, skill entity IDs are passed as paths for filesystem-based discovery.
    if (options?.skillSource) {
      config.skillSource = options.skillSource;
      // When using a versioned source, the skills resolver points to the root ('.')
      // since the CompositeVersionedSkillSource mounts each skill as a subdirectory.
      config.skills = ['.'];
    } else if (snapshot.skills && snapshot.skills.length > 0) {
      config.skills = snapshot.skills;
    }

    // Workspace tool configuration maps directly
    if (snapshot.tools) {
      config.tools = snapshot.tools;
    }

    if (snapshot.autoSync !== undefined) {
      config.autoSync = snapshot.autoSync;
    }

    if (snapshot.operationTimeout !== undefined) {
      config.operationTimeout = snapshot.operationTimeout;
    }

    return new Workspace(config);
  }

  /**
   * Resolve a stored filesystem config to a runtime WorkspaceFilesystem instance.
   * Looks up the provider by ID in the editor's registry (which includes built-in providers).
   */
  private async resolveFilesystem(fsConfig: StorageFilesystemConfig): Promise<WorkspaceFilesystem> {
    const provider = this.editor.__filesystems.get(fsConfig.provider);
    if (!provider) {
      throw new Error(
        `Filesystem provider "${fsConfig.provider}" is not registered. ` +
          `Register it via new MastraEditor({ filesystems: [yourProvider] })`,
      );
    }
    const config = { ...fsConfig.config, readOnly: fsConfig.readOnly };
    return await provider.createFilesystem(config);
  }

  /**
   * Resolve a stored sandbox config to a runtime WorkspaceSandbox instance.
   * Looks up the provider by ID in the editor's registry (which includes built-in providers).
   */
  private async resolveSandbox(sandboxConfig: StorageSandboxConfig): Promise<WorkspaceSandbox> {
    const provider = this.editor.__sandboxes.get(sandboxConfig.provider);
    if (!provider) {
      throw new Error(
        `Sandbox provider "${sandboxConfig.provider}" is not registered. ` +
          `Register it via new MastraEditor({ sandboxes: [yourProvider] })`,
      );
    }
    return await provider.createSandbox(sandboxConfig.config);
  }

  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateWorkspaceInput,
      StorageUpdateWorkspaceInput,
      StorageListWorkspacesInput,
      StorageListWorkspacesOutput,
      StorageListWorkspacesResolvedOutput,
      StorageResolvedWorkspaceType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('workspaces');
    if (!store) throw new Error('Workspaces storage domain is not available');

    return {
      create: input => store.create({ workspace: input }),
      getByIdResolved: id => store.getByIdResolved(id),
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }
}
