/**
 * Composio integration provider implementation
 *
 * Provides access to Composio's 500+ managed integrations through their V3 API.
 * Requires COMPOSIO_API_KEY environment variable for authentication.
 *
 * API Documentation: https://backend.composio.dev
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
 * Base URL for Composio V3 API
 */
const COMPOSIO_BASE_URL = 'https://backend.composio.dev';

/**
 * Composio API response types
 */
interface ComposioToolkitResponse {
  name: string;
  key: string;
  description: string;
  logo: string;
  categories?: string[];
  actions?: number;
}

interface ComposioToolResponse {
  name: string;
  key: string;
  description: string;
  parameters?: Record<string, unknown>;
  response?: Record<string, unknown>;
  appKey?: string;
  appName?: string;
}

interface ComposioListResponse<T> {
  items: T[];
  cursor?: string;
  hasMore?: boolean;
}

/**
 * Composio provider implementation
 *
 * Provides access to Composio's managed integrations through their V3 API.
 * Supports listing toolkits (apps), tools (actions), and fetching tool details.
 */
export class ComposioProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'composio';
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPOSIO_API_KEY;
    this.baseUrl = COMPOSIO_BASE_URL;
  }

  /**
   * Check if the provider has valid credentials configured
   */
  getStatus(): ProviderStatus {
    return {
      provider: 'composio',
      connected: !!this.apiKey,
      name: 'Composio',
      description: '500+ managed integrations with built-in auth',
      icon: '/icons/composio.svg',
    };
  }

  /**
   * List available toolkits (apps) from Composio
   */
  async listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const params = new URLSearchParams();
    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.category) {
      params.append('category', options.category);
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.cursor) {
      params.append('cursor', options.cursor);
    }

    const url = `${this.baseUrl}/api/v3/toolkits${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ComposioListResponse<ComposioToolkitResponse>;

    return {
      toolkits: data.items.map(toolkit => this.mapToolkit(toolkit)),
      nextCursor: data.cursor,
      hasMore: data.hasMore ?? false,
    };
  }

  /**
   * List available tools (actions) from Composio
   */
  async listTools(options?: ListToolsOptions): Promise<ListToolsResponse> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const params = new URLSearchParams();

    // Handle single toolkit or multiple toolkits
    if (options?.toolkitSlug) {
      params.append('toolkit_slug', options.toolkitSlug);
    } else if (options?.toolkitSlugs && options.toolkitSlugs.length > 0) {
      // Composio API may support comma-separated values or multiple parameters
      // Check API docs, but for now we'll use the first one as primary filter
      const firstToolkit = options.toolkitSlugs[0];
      if (firstToolkit) {
        params.append('toolkit_slug', firstToolkit);
      }
    }

    if (options?.search) {
      params.append('search', options.search);
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.cursor) {
      params.append('cursor', options.cursor);
    }

    const url = `${this.baseUrl}/api/v3/tools${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ComposioListResponse<ComposioToolResponse>;

    return {
      tools: data.items.map(tool => this.mapTool(tool)),
      nextCursor: data.cursor,
      hasMore: data.hasMore ?? false,
    };
  }

  /**
   * Get detailed information about a specific tool
   */
  async getTool(slug: string): Promise<ProviderTool> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/api/v3/tools/${slug}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const tool = (await response.json()) as ComposioToolResponse;
    return this.mapTool(tool);
  }

  /**
   * Map Composio toolkit response to ProviderToolkit
   */
  private mapToolkit(toolkit: ComposioToolkitResponse): ProviderToolkit {
    return {
      slug: toolkit.key,
      name: toolkit.name,
      description: toolkit.description,
      icon: toolkit.logo,
      category: toolkit.categories?.[0] ?? undefined,
      toolCount: toolkit.actions,
      metadata: {
        categories: toolkit.categories,
      },
    };
  }

  /**
   * Map Composio tool response to ProviderTool
   */
  private mapTool(tool: ComposioToolResponse): ProviderTool {
    return {
      slug: tool.key,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters || {},
      outputSchema: tool.response,
      toolkit: tool.appKey,
      metadata: {
        appName: tool.appName,
      },
    };
  }
}
