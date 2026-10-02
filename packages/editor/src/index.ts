import { Mastra } from '@mastra/core';
import type { AgentBuilderOptions, IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type {
  IMastraEditor,
  MastraEditorConfig,
  FilesystemProvider,
  SandboxProvider,
  BlobStoreProvider,
  BrowserProvider,
  WorkspaceProvider,
  WorkflowBuilderOptions,
  IWorkflowBuilder,
} from '@mastra/core/editor';
import type { IMastraLogger as Logger } from '@mastra/core/logger';
import { BUILT_IN_PROCESSOR_PROVIDERS } from '@mastra/core/processor-provider';
import type { ProcessorProvider } from '@mastra/core/processor-provider';
import {
  createGitHubSourceControlProviderFromEnv,
  FilesystemStore,
  MastraCompositeStore,
  SourceAgentsSourceControl,
} from '@mastra/core/storage';
import type { BlobStore, SourceControlProvider } from '@mastra/core/storage';
import { UnknownToolProviderError } from '@mastra/core/tool-provider';
import type { ToolProvider } from '@mastra/core/tool-provider';

import {
  EditorAgentNamespace,
  EditorMCPNamespace,
  EditorMCPServerNamespace,
  EditorPromptNamespace,
  EditorScorerNamespace,
  EditorWorkspaceNamespace,
  EditorSkillNamespace,
  EditorFavoritesNamespace,
} from './namespaces';
import { localFilesystemProvider, localSandboxProvider } from './providers';
import { snapshotsMatch } from './snapshots-match';

export type { MastraEditorConfig };

export { renderTemplate } from './template-engine';
export { evaluateRuleGroup } from './rule-evaluator';
export { resolveInstructionBlocks } from './instruction-builder';
export {
  EditorNamespace,
  CrudEditorNamespace,
  EditorAgentNamespace,
  EditorMCPNamespace,
  EditorMCPServerNamespace,
  EditorPromptNamespace,
  EditorScorerNamespace,
  EditorWorkspaceNamespace,
  EditorSkillNamespace,
  EditorFavoritesNamespace,
} from './namespaces';
export type { StorageAdapter } from './namespaces';
export { localFilesystemProvider, localSandboxProvider } from './providers';
export type { BrowserProvider } from '@mastra/core/editor';

export class MastraEditor implements IMastraEditor {
  /** @internal — exposed for namespace classes, not part of public API */
  __mastra?: Mastra;
  /** @internal — exposed for namespace classes, not part of public API */
  __logger?: Logger;

  private __toolProviders: Record<string, ToolProvider>;
  private __processorProviders: Record<string, ProcessorProvider>;
  private __source?: 'code' | 'db';
  private __codePath: string;
  private __sourceControlProvider?: SourceControlProvider;
  private readonly __builderConfig?: AgentBuilderOptions;
  private __builderInstance?: IAgentBuilder;
  private __builderResolved = false;
  private readonly __workflowBuilderConfig?: WorkflowBuilderOptions;
  private __workflowBuilderInstance?: IWorkflowBuilder;
  private __workflowBuilderResolved = false;

  /**
   * @internal — exposed for namespace classes to hydrate stored workspace configs.
   * Maps provider ID (e.g., 'local', 's3') to the provider descriptor.
   * Built-in providers are auto-registered; additional providers come from config.
   */
  readonly __filesystems: Map<string, FilesystemProvider>;

  /**
   * @internal — exposed for namespace classes to hydrate stored workspace configs.
   * Maps provider ID (e.g., 'local', 'e2b') to the provider descriptor.
   * Built-in providers are auto-registered; additional providers come from config.
   */
  readonly __sandboxes: Map<string, SandboxProvider>;

  /**
   * @internal — exposed for namespace classes to resolve blob stores.
   * Maps provider ID (e.g., 'storage', 's3') to the provider descriptor.
   * The built-in 'storage' provider uses the configured storage backend.
   * Additional providers come from config.
   */
  readonly __blobStores: Map<string, BlobStoreProvider>;

  /**
   * @internal — exposed for namespace classes to hydrate stored browser configs.
   * Maps provider ID (e.g., 'stagehand', 'agent-browser') to the provider descriptor.
   * No built-in providers — browser packages must be registered via config.
   */
  readonly __browsers: Map<string, BrowserProvider>;

  /**
   * @internal — exposed for namespace classes to hydrate stored workspace configs.
   * Maps provider ID to the provider descriptor.
   * No built-in providers — workspace providers must be registered via config.
   */
  readonly __workspaces: Map<string, WorkspaceProvider>;

  public readonly agent: EditorAgentNamespace;
  public readonly mcp: EditorMCPNamespace;
  public readonly mcpServer: EditorMCPServerNamespace;
  public readonly prompt: EditorPromptNamespace;
  public readonly scorer: EditorScorerNamespace;
  public readonly workspace: EditorWorkspaceNamespace;
  public readonly skill: EditorSkillNamespace;
  public readonly favorites: EditorFavoritesNamespace;

  constructor(config?: MastraEditorConfig) {
    this.__logger = config?.logger;
    this.__toolProviders = config?.toolProviders ?? {};
    this.__processorProviders = { ...BUILT_IN_PROCESSOR_PROVIDERS, ...config?.processorProviders };
    this.__source = config?.source;
    this.__codePath = config?.codePath ?? './mastra/editor';
    this.__sourceControlProvider =
      config?.sourceControlProvider ??
      createGitHubSourceControlProviderFromEnv(process.env, { pathPrefix: this.__codePath });

    // Built-in providers are always registered first, then merged with user-provided ones
    this.__filesystems = new Map<string, FilesystemProvider>();
    this.__filesystems.set(localFilesystemProvider.id, localFilesystemProvider);
    for (const [id, provider] of Object.entries(config?.filesystems ?? {})) {
      this.__filesystems.set(id, provider);
    }

    this.__sandboxes = new Map<string, SandboxProvider>();
    this.__sandboxes.set(localSandboxProvider.id, localSandboxProvider);
    for (const [id, provider] of Object.entries(config?.sandboxes ?? {})) {
      this.__sandboxes.set(id, provider);
    }

    // Blob store providers — no built-in default since the 'storage' fallback
    // is handled at resolve time via storage.getStore('blobs')
    this.__blobStores = new Map<string, BlobStoreProvider>();
    for (const [id, provider] of Object.entries(config?.blobStores ?? {})) {
      this.__blobStores.set(id, provider);
    }

    // Browser providers — no built-in providers; browser packages must be registered
    this.__browsers = new Map<string, BrowserProvider>();
    for (const [id, provider] of Object.entries(config?.browsers ?? {})) {
      this.__browsers.set(id, provider);
    }

    // Workspace providers — no built-in providers; workspace packages must be registered
    this.__workspaces = new Map<string, WorkspaceProvider>();
    for (const [id, provider] of Object.entries(config?.workspaces ?? {})) {
      this.__workspaces.set(id, provider);
    }

    this.agent = new EditorAgentNamespace(this);
    this.mcp = new EditorMCPNamespace(this);
    this.mcpServer = new EditorMCPServerNamespace(this);
    this.prompt = new EditorPromptNamespace(this);
    this.scorer = new EditorScorerNamespace(this);
    this.workspace = new EditorWorkspaceNamespace(this);
    this.skill = new EditorSkillNamespace(this);
    this.favorites = new EditorFavoritesNamespace(this);

    // Store builder config for EE feature
    this.__builderConfig = config?.builder;
    this.__workflowBuilderConfig = config?.workflowBuilder;
  }

  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void {
    this.__mastra = mastra;
    if (!this.__logger) {
      this.__logger = mastra.getLogger();
    }

    // Code source routes editor-owned domains away from the app's primary storage.
    // Local development uses a FilesystemStore at `codePath`; hosted/self-hosted
    // environments can provide a source provider so agent overrides are persisted
    // through source-control operations instead of a local container filesystem.
    if (this.__source === 'code') {
      const existingStorage = mastra.getStorage();

      if (this.__sourceControlProvider) {
        const sourceAgentsStore = new SourceAgentsSourceControl({
          provider: this.__sourceControlProvider,
        });
        const filesystemStore = new FilesystemStore({ dir: this.__codePath });

        mastra.setStorage(
          new MastraCompositeStore({
            id: `${existingStorage?.id ?? 'mastra'}-with-editor-source-control`,
            ...(existingStorage ? { default: existingStorage } : {}),
            editor: filesystemStore,
            domains: { agents: sourceAgentsStore },
          }),
        );
      } else {
        const filesystemStore = new FilesystemStore({ dir: this.__codePath });

        if (existingStorage) {
          mastra.setStorage(
            new MastraCompositeStore({
              id: `${existingStorage.id}-with-editor-filesystem`,
              default: existingStorage,
              editor: filesystemStore,
            }),
          );
        } else {
          mastra.setStorage(filesystemStore);
        }
      }
    }

    // Fire-and-forget: persist builder default workspace to DB if configured,
    // then reconcile orphaned builder workspaces
    this.ensureBuilderWorkspaces()
      .then(() => this.reconcileBuilderWorkspaces())
      .catch(err => {
        this.__logger?.warn('[MastraEditor] Failed to persist/reconcile builder workspaces on startup', {
          error: err,
        });
      });
  }

  /**
   * Ensure the builder default workspace is persisted to the DB.
   * Called automatically on startup when the editor registers with Mastra.
   * Goes through the normal create() path so hydration validates that
   * all providers (filesystem, sandbox) are properly registered.
   *
   * If the workspace already exists but its config has drifted from the
   * runtime workspace, the DB record is updated (creating a new version).
   * Builder-created workspaces are tagged with `metadata.source = 'builder'`
   * so they can be identified during reconciliation.
   */
  private async ensureBuilderWorkspaces(): Promise<void> {
    if (!this.hasEnabledBuilderConfig()) return;

    const builder = await this.resolveBuilder();
    const agentConfig = builder?.getConfiguration()?.agent;
    const workspaceRef = agentConfig?.workspace as { type: string; workspaceId?: string } | undefined;
    if (!workspaceRef || workspaceRef.type !== 'id' || !workspaceRef.workspaceId) return;

    const runtimeWorkspace = this.__mastra?.getWorkspaceById(workspaceRef.workspaceId);
    if (!runtimeWorkspace) return;

    const snapshot = await this.workspace.snapshotFromWorkspace(runtimeWorkspace);
    const builderMetadata = { source: 'builder' as const, builderWorkspaceId: workspaceRef.workspaceId };

    const existing = await this.workspace.getById(workspaceRef.workspaceId);
    if (!existing) {
      // First time — create with builder metadata
      await this.workspace.create({
        id: workspaceRef.workspaceId,
        metadata: builderMetadata,
        ...snapshot,
      });
      this.__logger?.info(`[MastraEditor] Persisted builder workspace '${workspaceRef.workspaceId}' to DB`);
      return;
    }

    // Workspace exists — check for config drift and backfill metadata
    const needsMetadataBackfill = !existing.metadata?.source;
    const configDrifted = !snapshotsMatch(existing, snapshot);

    if (needsMetadataBackfill || configDrifted) {
      const updateInput: Record<string, unknown> = { id: workspaceRef.workspaceId };
      if (needsMetadataBackfill) {
        updateInput.metadata = { ...existing.metadata, ...builderMetadata };
      }
      if (configDrifted) {
        Object.assign(updateInput, snapshot);
        this.__logger?.info(
          `[MastraEditor] Workspace '${workspaceRef.workspaceId}' config drifted — updating DB record`,
        );
      }
      await this.workspace.update(updateInput as any);
    }
  }

  /**
   * Archive builder-created workspaces that no longer match the current
   * builder configuration. Called after `ensureBuilderWorkspaces()` on startup.
   *
   * Only touches workspaces tagged with `metadata.source === 'builder'`.
   * The current builder workspace (if any) is never archived.
   */
  private async reconcileBuilderWorkspaces(): Promise<void> {
    if (!this.hasEnabledBuilderConfig()) return;

    const builder = await this.resolveBuilder();
    const agentConfig = builder?.getConfiguration()?.agent;
    const workspaceRef = agentConfig?.workspace as { type: string; workspaceId?: string } | undefined;

    // Determine the "current" builder workspace ID
    let currentWorkspaceId: string | undefined;
    if (workspaceRef?.type === 'id' && workspaceRef.workspaceId) {
      currentWorkspaceId = workspaceRef.workspaceId;
    }
    // For inline workspaces, the ID is deterministic based on config hash
    // (computed in agent.ensureStoredWorkspace), but since ensureBuilderWorkspaces
    // only handles type='id', we just need the current ID here.

    // Without a resolvable current workspace ID we can't safely distinguish
    // orphans from the active workspace, so skip reconciliation entirely.
    // (Bailing out leaves orphans untouched, which is recoverable; archiving
    // every builder-tagged workspace would not be.)
    if (!currentWorkspaceId) return;

    // List all builder-tagged workspaces
    const { workspaces: allWorkspaces } = await this.workspace.listResolved({
      perPage: false, // fetch all
      metadata: { source: 'builder' },
    });

    for (const ws of allWorkspaces) {
      // Skip the current builder workspace
      if (ws.id === currentWorkspaceId) continue;
      // Skip already archived
      if (ws.status === 'archived') continue;

      // Archive this orphaned builder workspace
      try {
        await this.workspace.update({ id: ws.id, status: 'archived' } as any);
        this.__logger?.info(`[MastraEditor] Archived orphaned builder workspace '${ws.id}'`);
      } catch (err) {
        this.__logger?.warn(`[MastraEditor] Failed to archive workspace '${ws.id}'`, { error: err });
      }
    }
  }

  /** Sync. OSS-safe. Does NOT import @mastra/editor/ee. */
  hasEnabledWorkflowBuilderConfig(): boolean {
    if (!this.__workflowBuilderConfig) return false;
    return this.__workflowBuilderConfig.enabled !== false;
  }

  /** Resolve the hidden workflow builder without adding its agent to Mastra. */
  async resolveWorkflowBuilder(): Promise<IWorkflowBuilder | undefined> {
    if (this.__workflowBuilderResolved) return this.__workflowBuilderInstance;

    if (!this.hasEnabledWorkflowBuilderConfig()) {
      this.__workflowBuilderResolved = true;
      return undefined;
    }

    await this.assertBuilderLicensed('Workflow Builder');
    const { EditorWorkflowBuilder } = await import('./ee');
    this.__workflowBuilderInstance = new EditorWorkflowBuilder(this.__workflowBuilderConfig, this.__mastra);
    this.__workflowBuilderResolved = true;
    return this.__workflowBuilderInstance;
  }

  /**
   * Sync. OSS-safe. Does NOT import @mastra/editor/ee.
   * Returns true if builder config is present and enabled.
   */
  hasEnabledBuilderConfig(): boolean {
    if (!this.__builderConfig) return false;
    return this.__builderConfig.enabled !== false;
  }

  /**
   * Async. Dynamic-imports @mastra/editor/ee on first call. Caches result.
   * Returns undefined if builder is not enabled.
   */
  async resolveBuilder(): Promise<IAgentBuilder | undefined> {
    if (this.__builderResolved) {
      return this.__builderInstance;
    }

    if (!this.hasEnabledBuilderConfig()) {
      this.__builderResolved = true;
      return undefined;
    }

    await this.assertBuilderLicensed('Agent Builder');

    const { EditorAgentBuilder } = await import('./ee');
    this.__builderInstance = new EditorAgentBuilder(this.__builderConfig);

    // Cross-validate: if the builder has a browser config with a provider that
    // isn't registered in __browsers, downgrade the feature flag and warn.
    const browserRef = this.__builderInstance.getConfiguration()?.agent?.browser;
    const browserFeatureOn = this.__builderInstance.getFeatures()?.agent?.browser === true;
    if (browserFeatureOn && browserRef?.config?.provider) {
      const providerId = browserRef.config.provider;
      if (!this.__browsers.has(providerId)) {
        const warning =
          `Agent Builder browser config references provider "${providerId}" but no matching browser ` +
          `provider is registered in \`editor.browsers\`. The browser toggle will be hidden. ` +
          `Register the provider: \`new MastraEditor({ browsers: { "${providerId}": yourProvider } })\`.`;
        // eslint-disable-next-line no-console
        console.warn(`[mastra:editor] ${warning}`);
        const features = this.__builderInstance.getFeatures()?.agent;
        if (features) {
          features.browser = false;
        }
      }
    }

    this.__builderResolved = true;
    return this.__builderInstance;
  }

  /**
   * Defense-in-depth license guard for the Agent Builder. Mirrors the
   * startup-time check in `MastraServer.validateAgentBuilderLicense()` so the
   * builder cannot be instantiated outside the server boot path without a
   * valid EE license. Dev environments bypass via `isEEEnabled()`.
   */
  private async assertBuilderLicensed(builderName: string): Promise<void> {
    try {
      const { isEEEnabled } = await import('@mastra/core/auth/ee');
      if (!isEEEnabled()) {
        throw new Error(
          `[mastra/auth-ee] ${builderName} is configured but no valid EE license was found.\n` +
            `${builderName} requires a Mastra Enterprise License for production use.\n` +
            'Set the MASTRA_EE_LICENSE environment variable with your license key.\n' +
            'Learn more: https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('[mastra/auth-ee]')) {
        throw err;
      }
      throw new Error(
        `[mastra/auth-ee] ${builderName} is configured but the EE module (@mastra/core/auth/ee) could not be loaded.\n` +
          'Ensure @mastra/core is updated to a version that includes EE support.',
      );
    }
  }

  /** Returns the editor's configured source, or undefined if unset. */
  getSource(): 'code' | 'db' | undefined {
    return this.__source;
  }

  /** Returns the configured source control provider, if any. */
  getSourceControlProvider(): SourceControlProvider | undefined {
    return this.__sourceControlProvider;
  }

  /** Registered tool providers */
  getToolProvider(id: string): ToolProvider | undefined {
    return this.__toolProviders[id];
  }

  /**
   * Like {@link getToolProvider}, but throws {@link UnknownToolProviderError}
   * when the id is unknown.
   */
  getToolProviderOrThrow(id: string): ToolProvider {
    const provider = this.__toolProviders[id];
    if (!provider) {
      throw new UnknownToolProviderError(id, Object.keys(this.__toolProviders));
    }
    return provider;
  }

  /** List all registered tool providers */
  getToolProviders(): Record<string, ToolProvider> {
    return this.__toolProviders;
  }

  /** Get a processor provider by ID */
  getProcessorProvider(id: string): ProcessorProvider | undefined {
    return this.__processorProviders[id];
  }

  /** List all registered processor providers */
  getProcessorProviders(): Record<string, ProcessorProvider> {
    return this.__processorProviders;
  }
  /** List all registered filesystem providers */
  getFilesystemProviders(): FilesystemProvider[] {
    return Array.from(this.__filesystems.values());
  }

  /** List all registered sandbox providers */
  getSandboxProviders(): SandboxProvider[] {
    return Array.from(this.__sandboxes.values());
  }

  /** List all registered blob store providers */
  getBlobStoreProviders(): BlobStoreProvider[] {
    return Array.from(this.__blobStores.values());
  }

  /**
   * Resolve a blob store from the provider registry, or fall back to the
   * storage backend's blobs domain.
   *
   * @param providerId - If specified, look up a registered provider by ID
   *   and create a blob store from the given config. If omitted, falls back
   *   to `storage.getStore('blobs')`.
   * @param providerConfig - Provider-specific configuration (only used when
   *   `providerId` is specified).
   */
  async resolveBlobStore(providerId?: string, providerConfig?: Record<string, unknown>): Promise<BlobStore> {
    // If a specific provider is requested, resolve it
    if (providerId) {
      const provider = this.__blobStores.get(providerId);
      if (!provider) {
        throw new Error(
          `Blob store provider "${providerId}" is not registered. ` +
            `Register it via new MastraEditor({ blobStores: { '${providerId}': yourProvider } })`,
        );
      }
      const blobStore = await provider.createBlobStore(providerConfig ?? {});
      await blobStore.init();
      return blobStore;
    }

    // Fall back to storage backend's blobs domain
    const storage = this.__mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const blobStore = await storage.getStore('blobs');
    if (!blobStore) throw new Error('Blob storage domain is not available');
    return blobStore;
  }
}
