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
 * Based on Arcade API OpenAPI spec at https://api.arcade.dev/v1/swagger
 */

/** Arcade parameter value schema */
interface ArcadeValueSchema {
  val_type: string;
  inner_val_type?: string;
  enum?: string[];
}

/** Arcade tool parameter */
interface ArcadeParameter {
  name: string;
  value_schema: ArcadeValueSchema;
  description?: string;
  required?: boolean;
  inferrable?: boolean;
}

/** Arcade tool input definition */
interface ArcadeInput {
  parameters?: ArcadeParameter[];
}

/** Arcade authorization requirement */
interface ArcadeAuthorizationRequirement {
  id?: string;
  oauth2?: {
    scopes?: string[];
  };
  provider_id?: string;
  provider_type?: string;
  status?: 'disabled' | 'enabled' | string;
  status_reason?: string;
  token_status?: 'not_started' | 'pending' | 'completed' | string;
}

/** Arcade secret requirement */
interface ArcadeSecretRequirement {
  key: string;
  met: boolean;
  status_reason?: string;
}

/** Arcade tool requirements */
interface ArcadeToolRequirements {
  authorization?: ArcadeAuthorizationRequirement;
  met: boolean;
  secrets?: ArcadeSecretRequirement[];
}

interface ArcadeToolResponse {
  fully_qualified_name: string;
  name: string;
  qualified_name?: string;
  description: string;
  toolkit?: {
    id?: string;
    name?: string;
    description?: string;
    version?: string;
  };
  input?: ArcadeInput;
  output?: {
    available_modes?: string[];
    description?: string;
    value_schema?: ArcadeValueSchema;
  };
  formatted_schema?: unknown;
  requirements?: ArcadeToolRequirements;
}

interface ArcadeListToolsResponse {
  items: ArcadeToolResponse[];
  total_count?: number;
  page_count?: number;
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
   * We fetch ALL tools to ensure we discover all available toolkits.
   */
  async listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    // Fetch ALL tools by paginating through the API to discover all toolkits
    const allTools: ArcadeToolResponse[] = [];
    const pageSize = 100;
    let offset = 0;
    let hasMoreTools = true;

    while (hasMoreTools) {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());

      const url = `${this.baseUrl}/v1/tools?${params.toString()}`;
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
      const toolItems = Array.isArray(data.items) ? data.items : [];
      allTools.push(...toolItems);

      // Check if there are more tools to fetch
      if (toolItems.length < pageSize) {
        hasMoreTools = false;
      } else if (data.total_count !== undefined && offset + pageSize >= data.total_count) {
        hasMoreTools = false;
      } else {
        offset += pageSize;
      }
    }

    // Group tools by toolkit to create toolkit summaries
    const toolkitMap = new Map<string, { name: string; tools: ArcadeToolResponse[] }>();

    for (const tool of allTools) {
      const toolkitSlug = tool.toolkit?.name || tool.toolkit?.id || 'general';
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

    // Convert to toolkit array with auth info
    let toolkits: ProviderToolkit[] = Array.from(toolkitMap.entries()).map(([slug, data]) => {
      // Check if any tools in this toolkit require authorization
      const toolsWithAuth = data.tools.filter(t => t.requirements?.authorization?.provider_id);
      const authProvider = toolsWithAuth[0]?.requirements?.authorization?.provider_id;
      const authProviderType = toolsWithAuth[0]?.requirements?.authorization?.provider_type;

      // Check how many tools have unmet requirements
      const toolsWithUnmetRequirements = data.tools.filter(t => t.requirements && !t.requirements.met);

      return {
        slug,
        name: data.name,
        description: data.tools[0]?.toolkit?.description || `${data.name} tools`,
        toolCount: data.tools.length,
        metadata: {
          source: 'arcade',
          // Auth info for the toolkit
          requiresAuth: toolsWithAuth.length > 0,
          authProvider,
          authProviderType,
          toolsRequiringAuth: toolsWithAuth.length,
          toolsWithUnmetRequirements: toolsWithUnmetRequirements.length,
        },
      };
    });

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

    // Safely handle empty or missing items array
    const toolItems = Array.isArray(data.items) ? data.items : [];
    let tools = toolItems.map(tool => this.mapTool(tool));

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
    const totalReturned = toolItems.length;
    const hasMore = totalReturned === limit && (data.total_count ? offset + limit < data.total_count : true);
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
   * Initiate authorization for a tool that requires OAuth
   *
   * @param toolName - The fully qualified tool name (e.g., "Google.ListEmails")
   * @param userId - The user ID for the authorization context
   * @returns Authorization response with URL if auth is needed
   */
  async authorize(
    toolName: string,
    userId: string,
  ): Promise<{
    status: 'pending' | 'completed';
    authorizationId?: string;
    authorizationUrl?: string;
    scopes?: string[];
  }> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/v1/auth/authorize`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool_name: toolName,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Arcade API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as {
      status: string;
      id?: string;
      url?: string;
      context?: {
        scopes?: string[];
      };
    };

    return {
      status: data.status === 'completed' ? 'completed' : 'pending',
      authorizationId: data.id,
      authorizationUrl: data.url,
      scopes: data.context?.scopes,
    };
  }

  /**
   * Wait for an authorization to complete
   *
   * @param authorizationId - The authorization ID from the authorize call
   * @param timeoutMs - Maximum time to wait (default 5 minutes)
   * @returns Whether authorization completed successfully
   */
  async waitForAuthorization(authorizationId: string, timeoutMs = 300000): Promise<boolean> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/v1/auth/status`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await fetch(`${url}?id=${authorizationId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Arcade API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { status: string };

      if (data.status === 'completed') {
        return true;
      }

      // Wait 2 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return false;
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
   * Convert Arcade's val_type to JSON Schema type
   */
  private arcadeTypeToJsonSchemaType(valType: string): string {
    const typeMap: Record<string, string> = {
      str: 'string',
      string: 'string',
      int: 'integer',
      integer: 'integer',
      float: 'number',
      number: 'number',
      bool: 'boolean',
      boolean: 'boolean',
      list: 'array',
      array: 'array',
      dict: 'object',
      object: 'object',
      any: 'string', // Default to string for any type
    };
    return typeMap[valType.toLowerCase()] || 'string';
  }

  /**
   * Convert Arcade parameter format to JSON Schema
   */
  private convertArcadeInputToJsonSchema(input?: ArcadeInput): Record<string, unknown> {
    if (!input?.parameters || input.parameters.length === 0) {
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of input.parameters) {
      const jsonSchemaType = this.arcadeTypeToJsonSchemaType(param.value_schema.val_type);
      const propSchema: Record<string, unknown> = {
        type: jsonSchemaType,
      };

      // Add description if available
      if (param.description) {
        propSchema.description = param.description;
      }

      // Handle array types with inner type
      if (jsonSchemaType === 'array' && param.value_schema.inner_val_type) {
        propSchema.items = {
          type: this.arcadeTypeToJsonSchemaType(param.value_schema.inner_val_type),
        };
      }

      // Handle enum values
      if (param.value_schema.enum && param.value_schema.enum.length > 0) {
        propSchema.enum = param.value_schema.enum;
      }

      properties[param.name] = propSchema;

      // Track required fields
      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Map Arcade tool response to ProviderTool
   */
  private mapTool(tool: ArcadeToolResponse): ProviderTool {
    const toolkitSlug = tool.toolkit?.name || 'general';

    // Build metadata including authorization requirements
    const metadata: Record<string, unknown> = {
      arcadeId: tool.fully_qualified_name,
      qualifiedName: tool.qualified_name,
    };

    // Include authorization info if present
    if (tool.requirements) {
      metadata.requirementsMet = tool.requirements.met;

      if (tool.requirements.authorization) {
        const auth = tool.requirements.authorization;
        metadata.authorization = {
          providerId: auth.provider_id,
          providerType: auth.provider_type,
          status: auth.status,
          tokenStatus: auth.token_status,
          scopes: auth.oauth2?.scopes,
        };
      }

      // Include secrets requirements if any
      if (tool.requirements.secrets && tool.requirements.secrets.length > 0) {
        metadata.requiredSecrets = tool.requirements.secrets.map(s => ({
          key: s.key,
          met: s.met,
        }));
      }
    }

    return {
      slug: tool.fully_qualified_name || tool.name,
      name: tool.name,
      description: tool.description,
      inputSchema: this.convertArcadeInputToJsonSchema(tool.input),
      outputSchema: tool.output,
      toolkit: toolkitSlug,
      metadata,
    };
  }
}
