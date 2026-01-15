/**
 * Arcade.dev integration provider implementation
 *
 * Provides access to Arcade.dev's tool calling platform with auth management.
 * Requires ARCADE_API_KEY environment variable for authentication.
 *
 * API Documentation: https://api.arcade.dev
 */

import type {
  IntegrationProviderType,
  ListToolkitsOptions,
  ListToolkitsResponse,
  ListToolsOptions,
  ListToolsResponse,
  ProviderStatus,
  ProviderTool,
  ProviderToolkit,
  ToolProvider,
} from './types';

/**
 * Base URL for Arcade.dev API
 */
const ARCADE_BASE_URL = 'https://api.arcade.dev';

/**
 * Arcade API response types
 */
interface ArcadeToolResponse {
  id: string;
  name: string;
  description: string;
  toolkit?: string;
  input?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  output?: {
    type?: string;
    properties?: Record<string, unknown>;
  };
}

interface ArcadeListToolsResponse {
  tools: ArcadeToolResponse[];
  total?: number;
  limit?: number;
  offset?: number;
}

/**
 * Arcade provider implementation
 *
 * Provides access to Arcade.dev's tools through their API.
 * Note: Arcade may not have explicit toolkit groupings, so we derive them from tool names or categories.
 */
export class ArcadeProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'arcade';
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ARCADE_API_KEY;
    this.baseUrl = ARCADE_BASE_URL;
  }

  /**
   * Check if the provider has valid credentials configured
   */
  getStatus(): ProviderStatus {
    return {
      provider: 'arcade',
      connected: !!this.apiKey,
      name: 'Arcade.dev',
      description: 'Tool calling platform with auth management',
      icon: '/icons/arcade.svg',
    };
  }

  /**
   * List available toolkits from Arcade
   *
   * Note: Arcade API doesn't provide explicit toolkit groupings, so we derive them
   * from tool toolkit field. This method aggregates tools to create toolkit summaries.
   */
  async listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    // Fetch all tools to derive toolkits
    const params = new URLSearchParams();
    if (options?.limit) {
      // Fetch enough tools to ensure we get all toolkits
      params.append('limit', Math.max(options.limit * 10, 100).toString());
    } else {
      params.append('limit', '100');
    }

    const url = `${this.baseUrl}/v1/tools${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Arcade API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ArcadeListToolsResponse;

    // Group tools by toolkit to create toolkit summaries
    const toolkitMap = new Map<string, { name: string; tools: ArcadeToolResponse[] }>();

    for (const tool of data.tools) {
      const toolkitSlug = tool.toolkit || 'general';
      const existing = toolkitMap.get(toolkitSlug);
      if (existing) {
        existing.tools.push(tool);
      } else {
        toolkitMap.set(toolkitSlug, {
          name: this.formatToolkitName(toolkitSlug),
          tools: [tool],
        });
      }
    }

    // Convert to toolkit array
    let toolkits: ProviderToolkit[] = Array.from(toolkitMap.entries()).map(([slug, data]) => ({
      slug,
      name: data.name,
      description: `${data.name} tools`,
      toolCount: data.tools.length,
      metadata: {
        source: 'arcade',
      },
    }));

    // Apply search filter if provided
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      toolkits = toolkits.filter(
        toolkit =>
          toolkit.name.toLowerCase().includes(searchLower) ||
          toolkit.description?.toLowerCase().includes(searchLower),
      );
    }

    // Apply category filter if provided (Arcade may not have categories, so we skip this)
    if (options?.category) {
      // Arcade doesn't have categories, so we skip this filter
      // In a real implementation, we might map toolkit slugs to categories
    }

    // Simple pagination for derived toolkits
    const limit = options?.limit || 20;
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const paginatedToolkits = toolkits.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < toolkits.length;
    const nextCursor = hasMore ? (startIndex + limit).toString() : undefined;

    return {
      toolkits: paginatedToolkits,
      nextCursor,
      hasMore,
    };
  }

  /**
   * List available tools from Arcade
   */
  async listTools(options?: ListToolsOptions): Promise<ListToolsResponse> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    const params = new URLSearchParams();

    // Handle toolkit filtering
    if (options?.toolkitSlug) {
      params.append('toolkit', options.toolkitSlug);
    } else if (options?.toolkitSlugs && options.toolkitSlugs.length > 0) {
      // For multiple toolkits, we'll filter client-side after fetching
      // Arcade API may not support multiple toolkit filters in one request
      const firstToolkit = options.toolkitSlugs[0];
      if (firstToolkit) {
        params.append('toolkit', firstToolkit);
      }
    }

    // Convert cursor-based pagination to offset-based for Arcade
    const limit = options?.limit || 20;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const url = `${this.baseUrl}/v1/tools${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Arcade API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ArcadeListToolsResponse;

    let tools = data.tools.map(tool => this.mapTool(tool));

    // Client-side filtering for multiple toolkits if needed
    if (options?.toolkitSlugs && options.toolkitSlugs.length > 1) {
      tools = tools.filter(tool => tool.toolkit && options.toolkitSlugs!.includes(tool.toolkit));
    }

    // Apply search filter if provided and not already handled by API
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      tools = tools.filter(
        tool =>
          tool.name.toLowerCase().includes(searchLower) ||
          tool.description.toLowerCase().includes(searchLower),
      );
    }

    // Calculate next cursor (convert offset back to cursor)
    const totalReturned = data.tools.length;
    const hasMore = totalReturned === limit && (data.total ? offset + limit < data.total : true);
    const nextCursor = hasMore ? (offset + limit).toString() : undefined;

    return {
      tools,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get detailed information about a specific tool
   */
  async getTool(slug: string): Promise<ProviderTool> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/v1/tools/${slug}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Arcade API error: ${response.status} ${response.statusText}`);
    }

    const tool = (await response.json()) as ArcadeToolResponse;
    return this.mapTool(tool);
  }

  /**
   * Format toolkit slug to a readable name
   */
  private formatToolkitName(slug: string): string {
    return slug
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Map Arcade tool response to ProviderTool
   */
  private mapTool(tool: ArcadeToolResponse): ProviderTool {
    return {
      slug: tool.id || tool.name,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input || {},
      outputSchema: tool.output,
      toolkit: tool.toolkit || 'general',
      metadata: {
        arcadeId: tool.id,
      },
    };
  }
}
