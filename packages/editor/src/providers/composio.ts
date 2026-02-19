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
import type { Tool as ComposioTool, ToolKitItem, ToolListParams as ComposioToolListParams } from '@composio/core';
import { MastraProvider } from '@composio/mastra';
import type { MastraTool, MastraToolCollection } from '@composio/mastra';

export interface ComposioToolProviderConfig {
  /** Composio API key */
  apiKey: string;
}

/**
 * Composio tool provider adapter.
 *
 * Uses `@composio/core` + `@composio/mastra` SDKs for both tool discovery
 * and runtime resolution. Both packages are optional peer dependencies and
 * tree-shaken if this provider class isn't imported.
 *
 * Discovery methods (`listToolkits`, `listTools`, `getToolSchema`) use the
 * raw Composio client (no userId required).
 *
 * Runtime method (`resolveTools`) uses the MastraProvider so returned tools are
 * already in Mastra's `createTool()` format.
 */
export class ComposioToolProvider implements ToolProvider {
  readonly info: ToolProviderInfo = {
    id: 'composio',
    name: 'Composio',
    description: 'Access 10,000+ tools from 150+ apps via Composio',
  };

  private apiKey: string;
  private rawClient: Composio | null = null;
  private mastraClient: Composio<MastraProvider> | null = null;

  constructor(config: ComposioToolProviderConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * Get or create a raw Composio client (no provider — for discovery only).
   */
  private getRawClient(): Composio {
    if (!this.rawClient) {
      this.rawClient = new Composio({ apiKey: this.apiKey });
    }
    return this.rawClient;
  }

  /**
   * Get or create a Composio client with MastraProvider (for runtime tools).
   */
  private getMastraClient(): Composio<MastraProvider> {
    if (!this.mastraClient) {
      this.mastraClient = new Composio({
        apiKey: this.apiKey,
        provider: new MastraProvider(),
      });
    }
    return this.mastraClient;
  }

  /**
   * List available toolkits via `composio.toolkits.get({})`.
   * Returns: `ToolKitListResponse` — an array of `{ slug, name, meta: { description, logo, ... } }`.
   */
  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    const composio = this.getRawClient();
    const toolkits: ToolKitItem[] = await composio.toolkits.get({});

    const data: ToolProviderToolkit[] = toolkits.map(tk => ({
      slug: tk.slug,
      name: tk.name,
      description: tk.meta?.description,
      icon: tk.meta?.logo,
    }));
    return { data };
  }

  /**
   * List available tools via `composio.tools.getRawComposioTools()`.
   * No userId required — returns raw tool definitions for UI browsing.
   */
  async listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    const composio = this.getRawClient();

    // ToolListParams is a discriminated union in TypeScript but the
    // underlying Zod schema accepts `limit` on every variant.  We cast
    // through the base type so `limit` is always forwarded.
    const limit = options?.perPage;
    const query: ComposioToolListParams = (
      options?.toolkit
        ? { toolkits: [options.toolkit], limit, search: options?.search }
        : options?.search
          ? { search: options.search, limit }
          : { toolkits: [] as string[], limit }
    ) as ComposioToolListParams;

    const rawTools: ComposioTool[] = await composio.tools.getRawComposioTools(query);

    const data: ToolProviderToolInfo[] = rawTools.map(tool => ({
      slug: tool.slug,
      name: tool.name ?? tool.slug,
      description: tool.description,
      toolkit: tool.toolkit?.slug,
    }));

    return {
      data,
      pagination: {
        page: options?.page ?? 1,
        perPage: limit,
        hasMore: limit !== undefined && rawTools.length >= limit,
      },
    };
  }

  /**
   * Get JSON schema for a specific tool via `composio.tools.getRawComposioToolBySlug()`.
   */
  async getToolSchema(toolSlug: string): Promise<Record<string, unknown> | null> {
    try {
      const composio = this.getRawClient();
      const tool: ComposioTool = await composio.tools.getRawComposioToolBySlug(toolSlug);
      if (!tool) return null;
      return (tool.inputParameters ?? {}) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Resolve executable tools in Mastra format via `composio.tools.get(userId, { tools: [...] })`.
   *
   * Uses MastraProvider so returned tools are `ReturnType<typeof createTool>` — compatible
   * with Mastra's `ToolAction` interface.
   */
  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<unknown, unknown>>> {
    if (toolSlugs.length === 0) return {};

    const userId = options?.userId ?? 'default';
    const composio = this.getMastraClient();

    // composio.tools.get returns MastraToolCollection = Record<string, MastraTool>
    const mastraTools: MastraToolCollection = await composio.tools.get(userId, { tools: toolSlugs });

    const result: Record<string, ToolAction<unknown, unknown>> = {};
    const entries: [string, MastraTool][] = Object.entries(mastraTools ?? {});

    for (const [key, tool] of entries) {
      if (!tool) continue;
      const slug = tool.id ?? key;
      const descOverride = toolConfigs?.[slug]?.description;
      if (descOverride) {
        result[slug] = { ...tool, description: descOverride };
      } else {
        result[slug] = tool;
      }
    }

    return result;
  }
}
