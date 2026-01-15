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
 * Composio authentication schemes (lowercase in API responses)
 */
type ComposioAuthScheme = 'oauth2' | 'oauth1' | 'api_key' | 'basic' | 'bearer_token' | 'no_auth';

/**
 * Composio API response types
 */
interface ComposioToolkitResponse {
  name: string;
  slug: string;
  meta?: {
    description?: string;
    logo?: string;
    tools_count?: number;
    categories?: Array<{ id: string; name: string }>;
  };
  // Auth info - available directly on toolkit response
  no_auth?: boolean;
  auth_schemes?: ComposioAuthScheme[];
  composio_managed_auth_schemes?: ComposioAuthScheme[];
}

interface ComposioToolResponse {
  name: string;
  slug: string;
  description: string;
  input_parameters?: Record<string, unknown>;
  output_parameters?: Record<string, unknown>;
  toolkit?: {
    slug: string;
    name: string;
    logo?: string;
  };
}

interface ComposioListResponse<T> {
  items: T[];
  cursor?: string;
  hasMore?: boolean;
}

/**
 * Auth config from Composio API
 */
interface ComposioAuthConfigResponse {
  id: string;
  toolkit_slug: string;
  auth_scheme: ComposioAuthScheme;
  is_composio_managed: boolean;
  name?: string;
  created_at?: string;
  expected_input_fields?: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

/**
 * Connected account from Composio API
 */
interface ComposioConnectedAccountResponse {
  id: string;
  toolkit_slug: string;
  auth_config_id: string;
  user_id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'FAILED';
  created_at?: string;
}

/**
 * Auth link response from Composio API
 */
interface ComposioAuthLinkResponse {
  redirect_url: string;
  connected_account_id: string;
  link_token?: string;
  expires_at?: string;
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
    const toolkits = data.items.map(toolkit => this.mapToolkit(toolkit));

    return {
      toolkits,
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
    // Use slug from API, falling back to generating a slug from the name
    const slug = toolkit.slug || toolkit.name?.toLowerCase().replace(/\s+/g, '_') || '';
    const categories = toolkit.meta?.categories?.map(c => c.name);

    // Determine auth type from toolkit response
    let authType: 'oauth' | 'secret' | undefined;
    let authSchemes: ComposioAuthScheme[] = [];

    if (toolkit.no_auth) {
      // No auth required
      authType = undefined;
    } else if (toolkit.composio_managed_auth_schemes?.length) {
      // Has Composio-managed auth - use first scheme to determine type
      authSchemes = toolkit.composio_managed_auth_schemes;
      authType = this.mapAuthSchemeToType(authSchemes[0]!);
    } else if (toolkit.auth_schemes?.length) {
      // Has auth schemes but not Composio-managed
      authSchemes = toolkit.auth_schemes;
      authType = this.mapAuthSchemeToType(authSchemes[0]!);
    }

    return {
      slug,
      name: toolkit.name,
      description: toolkit.meta?.description || `Tools for ${toolkit.name}`,
      icon: toolkit.meta?.logo,
      category: categories?.[0] ?? undefined,
      toolCount: toolkit.meta?.tools_count,
      metadata: {
        categories,
        // Auth info
        authType,
        authSchemes,
        noAuth: toolkit.no_auth,
        composioManagedAuthSchemes: toolkit.composio_managed_auth_schemes,
      },
    };
  }

  /**
   * Map Composio tool response to ProviderTool
   */
  private mapTool(tool: ComposioToolResponse): ProviderTool {
    // Use slug from API, falling back to generating a slug from the name
    const slug = tool.slug || tool.name?.toLowerCase().replace(/\s+/g, '_') || '';
    return {
      slug,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_parameters || {},
      outputSchema: tool.output_parameters,
      toolkit: tool.toolkit?.slug,
      metadata: {
        toolkitName: tool.toolkit?.name,
        toolkitLogo: tool.toolkit?.logo,
      },
    };
  }

  /**
   * Get the default (Composio-managed) auth config for a toolkit
   */
  async getAuthConfig(toolkitSlug: string): Promise<{
    id: string;
    authScheme: ComposioAuthScheme;
    isComposioManaged: boolean;
    expectedInputFields?: Array<{ name: string; type: string; required: boolean; description?: string }>;
  } | null> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const params = new URLSearchParams();
    params.append('toolkit_slug', toolkitSlug);

    const url = `${this.baseUrl}/api/v3/auth_configs?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ComposioListResponse<ComposioAuthConfigResponse>;
    const authConfig = data.items?.[0];

    if (!authConfig) {
      return null;
    }

    return {
      id: authConfig.id,
      authScheme: authConfig.auth_scheme,
      isComposioManaged: authConfig.is_composio_managed,
      expectedInputFields: authConfig.expected_input_fields,
    };
  }

  /**
   * Check if a user has an active connected account for a toolkit
   */
  async getConnectedAccount(
    toolkitSlug: string,
    userId: string,
  ): Promise<{
    id: string;
    status: 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'FAILED';
    authConfigId: string;
  } | null> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const params = new URLSearchParams();
    params.append('toolkit_slugs', toolkitSlug);
    params.append('user_ids', userId);
    params.append('statuses', 'ACTIVE');

    const url = `${this.baseUrl}/api/v3/connected_accounts?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ComposioListResponse<ComposioConnectedAccountResponse>;
    const account = data.items[0];

    if (!account) {
      return null;
    }

    return {
      id: account.id,
      status: account.status,
      authConfigId: account.auth_config_id,
    };
  }

  /**
   * Initiate authorization for a toolkit
   * Creates an auth link that the user can visit to connect their account
   *
   * @param toolkitSlug - The toolkit slug (e.g., "gmail", "github")
   * @param userId - The user ID for the authorization context
   * @param callbackUrl - Optional callback URL after authorization
   * @returns Authorization response with URL if auth is needed
   */
  async authorize(
    toolkitSlug: string,
    userId: string,
    callbackUrl?: string,
  ): Promise<{
    status: 'pending' | 'completed';
    authorizationId?: string;
    authorizationUrl?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    // First check if user already has an active connection
    const existingAccount = await this.getConnectedAccount(toolkitSlug, userId);
    if (existingAccount && existingAccount.status === 'ACTIVE') {
      return {
        status: 'completed',
        authorizationId: existingAccount.id,
      };
    }

    // Get the Composio-managed auth config for this toolkit
    const authConfig = await this.getAuthConfig(toolkitSlug);
    console.log('[Composio] Auth config for', toolkitSlug, ':', JSON.stringify(authConfig, null, 2));

    if (!authConfig) {
      throw new Error(`No Composio-managed auth config found for toolkit: ${toolkitSlug}`);
    }

    // If it's a no-auth toolkit, mark as completed
    if (authConfig.authScheme === 'no_auth') {
      return {
        status: 'completed',
      };
    }

    // Create an auth link for the user
    const url = `${this.baseUrl}/api/v3/connected_accounts/link`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_config_id: authConfig.id,
        user_id: userId,
        ...(callbackUrl && { callback_url: callbackUrl }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Composio API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as ComposioAuthLinkResponse;

    // Log the response for debugging
    console.log('[Composio] Auth link response:', JSON.stringify(data, null, 2));

    if (!data.redirect_url) {
      throw new Error(`Composio API returned no authorization URL. Response: ${JSON.stringify(data)}`);
    }

    return {
      status: 'pending',
      authorizationId: data.connected_account_id,
      authorizationUrl: data.redirect_url,
    };
  }

  /**
   * Check the status of a connected account
   */
  async checkAuthorizationStatus(
    connectedAccountId: string,
  ): Promise<{ status: 'pending' | 'completed' | 'failed'; completed: boolean }> {
    if (!this.apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }

    const url = `${this.baseUrl}/api/v3/connected_accounts/${connectedAccountId}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ComposioConnectedAccountResponse;

    const statusMap: Record<string, 'pending' | 'completed' | 'failed'> = {
      ACTIVE: 'completed',
      PENDING: 'pending',
      EXPIRED: 'failed',
      FAILED: 'failed',
    };

    const status = statusMap[data.status] || 'pending';

    return {
      status,
      completed: data.status === 'ACTIVE',
    };
  }

  /**
   * Map auth scheme to a simpler auth type for UI display
   */
  private mapAuthSchemeToType(scheme: ComposioAuthScheme | string): 'oauth' | 'secret' | undefined {
    // API may return uppercase or lowercase values
    const normalizedScheme = scheme.toLowerCase();
    switch (normalizedScheme) {
      case 'oauth2':
      case 'oauth1':
        return 'oauth';
      case 'api_key':
      case 'basic':
      case 'bearer_token':
        return 'secret';
      case 'no_auth':
      default:
        return undefined;
    }
  }
}
