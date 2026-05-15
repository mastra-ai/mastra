import type {
  ToolProvider,
  ToolProviderInfo,
  ToolProviderToolkit,
  ToolProviderToolInfo,
  ToolProviderListResult,
  ListToolProviderToolsOptions,
  ResolveToolProviderToolsOptions,
} from '@mastra/core/tool-provider';
import type { ToolAction } from '@mastra/core/tools';
import type { StorageToolConfig } from '@mastra/core/storage';

import { Composio } from '@composio/core';
import type { Tool as ComposioTool } from '@composio/core';

import { ComposioToolIntegration } from './composio-integration';

export interface ComposioToolProviderConfig {
  /** Composio API key */
  apiKey: string;
}

/**
 * Legacy Composio adapter that conforms to the deprecated {@link ToolProvider}
 * interface.
 *
 * @deprecated Use {@link ComposioToolIntegration} from `@mastra/editor/composio`.
 * This class is a thin translation layer around `ComposioToolIntegration` kept
 * for backwards compatibility with the `MastraEditorConfig.toolProviders`
 * Record-shape config and the `editor.getToolProvider(id)` accessor. It is
 * scheduled for removal in the next coordinated breaking-change release of
 * `@mastra/editor`. New code should construct `ComposioToolIntegration`
 * directly and register it via `toolIntegrations: [...]`.
 */
export class ComposioToolProvider implements ToolProvider {
  readonly info: ToolProviderInfo = {
    id: 'composio',
    name: 'Composio',
    description: 'Access 10,000+ tools from 150+ apps via Composio',
  };

  private readonly apiKey: string;
  private readonly integration: ComposioToolIntegration;
  private schemaClient: Composio | null = null;

  constructor(config: ComposioToolProviderConfig) {
    this.apiKey = config.apiKey;
    this.integration = new ComposioToolIntegration({ apiKey: config.apiKey });
  }

  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    const { data } = await this.integration.listToolServices();
    return {
      data: data.map(service => ({
        slug: service.slug,
        name: service.name,
        description: service.description,
        icon: service.icon,
      })),
    };
  }

  async listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    const result = await this.integration.listTools({
      toolService: options?.toolkit,
      search: options?.search,
      page: options?.page,
      perPage: options?.perPage,
    });
    return {
      data: result.data.map(tool => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        toolkit: tool.toolService,
      })),
      pagination: result.pagination,
    };
  }

  /**
   * `getToolSchema` has no equivalent on `ToolIntegration`, so this is the
   * one Composio SDK call site that lives directly on the shim. The client
   * is constructed lazily and cached per instance.
   */
  async getToolSchema(toolSlug: string): Promise<Record<string, unknown> | null> {
    try {
      const composio = this.getSchemaClient();
      const tool: ComposioTool = await composio.tools.getRawComposioToolBySlug(toolSlug);
      if (!tool) return null;
      return (tool.inputParameters ?? {}) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<unknown, unknown>>> {
    if (toolSlugs.length === 0) return {};

    const toolMeta: Record<string, { description?: string }> = {};
    if (toolConfigs) {
      for (const [slug, cfg] of Object.entries(toolConfigs)) {
        if (cfg?.description) toolMeta[slug] = { description: cfg.description };
      }
    }

    // Legacy MCP-shaped path has no concept of a pinned connection. The
    // integration's `resolveTools` falls back to user-scoped resolution
    // when `connectionId` is empty, so the Composio backend picks the
    // single active connected account for the resolved userId.
    const authorId = typeof options?.userId === 'string' ? options.userId : undefined;

    const resolved = await this.integration.resolveTools({
      toolSlugs,
      toolMeta,
      connectionId: '',
      authorId,
      requestContext: options?.requestContext,
    });

    return resolved as Record<string, ToolAction<unknown, unknown>>;
  }

  private getSchemaClient(): Composio {
    if (!this.schemaClient) {
      this.schemaClient = new Composio({ apiKey: this.apiKey });
    }
    return this.schemaClient;
  }
}
