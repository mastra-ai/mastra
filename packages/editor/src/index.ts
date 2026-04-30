import { Mastra } from '@mastra/core';
import type { AgentBuilderOptions, IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type {
  IMastraEditor,
  MastraEditorConfig,
  FilesystemProvider,
  SandboxProvider,
  BlobStoreProvider,
  BrowserProvider,
} from '@mastra/core/editor';
import type { IMastraLogger as Logger } from '@mastra/core/logger';
import { BUILT_IN_PROCESSOR_PROVIDERS } from '@mastra/core/processor-provider';
import type { ProcessorProvider } from '@mastra/core/processor-provider';
import type { BlobStore } from '@mastra/core/storage';
import type { ToolProvider } from '@mastra/core/tool-provider';

import {
  EditorAgentNamespace,
  EditorMCPNamespace,
  EditorMCPServerNamespace,
  EditorPromptNamespace,
  EditorScorerNamespace,
  EditorWorkspaceNamespace,
  EditorSkillNamespace,
  EditorStarsNamespace,
} from './namespaces';
import { localFilesystemProvider, localSandboxProvider } from './providers';

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
  EditorStarsNamespace,
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
  private readonly __builderConfig?: AgentBuilderOptions;
  private __builderInstance?: IAgentBuilder;
  private __builderResolved = false;

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

  public readonly agent: EditorAgentNamespace;
  public readonly mcp: EditorMCPNamespace;
  public readonly mcpServer: EditorMCPServerNamespace;
  public readonly prompt: EditorPromptNamespace;
  public readonly scorer: EditorScorerNamespace;
  public readonly workspace: EditorWorkspaceNamespace;
  public readonly skill: EditorSkillNamespace;
  public readonly stars: EditorStarsNamespace;

  constructor(config?: MastraEditorConfig) {
    this.__logger = config?.logger;
    this.__toolProviders = config?.toolProviders ?? {};
    this.__processorProviders = { ...BUILT_IN_PROCESSOR_PROVIDERS, ...config?.processorProviders };

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

    this.agent = new EditorAgentNamespace(this);
    this.mcp = new EditorMCPNamespace(this);
    this.mcpServer = new EditorMCPServerNamespace(this);
    this.prompt = new EditorPromptNamespace(this);
    this.scorer = new EditorScorerNamespace(this);
    this.workspace = new EditorWorkspaceNamespace(this);
    this.skill = new EditorSkillNamespace(this);
    this.stars = new EditorStarsNamespace(this);

    // Store builder config for EE feature
    this.__builderConfig = config?.builder;
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

    // Fire-and-forget: persist builder default workspace to DB if configured
    this.ensureBuilderWorkspaces().catch(err => {
      this.__logger?.warn('[MastraEditor] Failed to persist builder default workspace on startup', { error: err });
    });
  }

  /**
   * Ensure the builder default workspace is persisted to the DB.
   * Called automatically on startup when the editor registers with Mastra.
   * Goes through the normal create() path so hydration validates that
   * all providers (filesystem, sandbox) are properly registered.
   */
  private async ensureBuilderWorkspaces(): Promise<void> {
    if (!this.hasEnabledBuilderConfig()) return;

    const builder = await this.resolveBuilder();
    const agentConfig = builder?.getConfiguration()?.agent;
    const workspaceRef = agentConfig?.workspace as { type: string; workspaceId?: string } | undefined;
    if (!workspaceRef || workspaceRef.type !== 'id' || !workspaceRef.workspaceId) return;

    // Already persisted?
    const existing = await this.workspace.getById(workspaceRef.workspaceId);
    if (existing) return;

    const runtimeWorkspace = this.__mastra?.getWorkspaceById(workspaceRef.workspaceId);
    if (!runtimeWorkspace) return;

    const snapshot = this.workspace.snapshotFromWorkspace(runtimeWorkspace);
    await this.workspace.create({
      id: workspaceRef.workspaceId,
      ...snapshot,
    });
    this.__logger?.info(`[MastraEditor] Persisted builder workspace '${workspaceRef.workspaceId}' to DB`);
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

  /** Registered tool providers */
  getToolProvider(id: string): ToolProvider | undefined {
    return this.__toolProviders[id];
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
