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
 * Static list of known Arcade toolkits.
 * This avoids the expensive operation of fetching all 7000+ tools just to discover toolkit names.
 * Updated: 2025-01-15
 */
const ARCADE_TOOLKITS = [
  'AirtableApi',
  'ArcadeEngineApi',
  'Asana',
  'AsanaApi',
  'AshbyApi',
  'BoxApi',
  'Brightdata',
  'CalendlyApi',
  'Clickup',
  'ClickupApi',
  'CodeSandbox',
  'Confluence',
  'CursorAgentsApi',
  'CustomerioApi',
  'CustomerioPipelinesApi',
  'CustomerioTrackApi',
  'DatadogApi',
  'Dropbox',
  'E2b',
  'ExaApi',
  'Figma',
  'FigmaApi',
  'Firecrawl',
  'FreshserviceApi',
  'Github',
  'GithubApi',
  'Gmail',
  'Google',
  'GoogleCalendar',
  'GoogleContacts',
  'GoogleDocs',
  'GoogleDrive',
  'GoogleFinance',
  'GoogleFlights',
  'GoogleHotels',
  'GoogleJobs',
  'GoogleMaps',
  'GoogleNews',
  'GoogleSearch',
  'GoogleSheets',
  'GoogleShopping',
  'GoogleSlides',
  'Hubspot',
  'HubspotAutomationApi',
  'HubspotCmsApi',
  'HubspotConversationsApi',
  'HubspotCrmApi',
  'HubspotEventsApi',
  'HubspotMarketingApi',
  'HubspotMeetingsApi',
  'HubspotUsersApi',
  'Imgflip',
  'IntercomApi',
  'Jira',
  'Linear',
  'Linkedin',
  'LumaApi',
  'MailchimpMarketingApi',
  'Math',
  'Microsoft',
  'MicrosoftTeams',
  'MiroApi',
  'NotionToolkit',
  'OutlookCalendar',
  'OutlookMail',
  'Pagerduty',
  'PagerdutyApi',
  'PosthogApi',
  'Pylon',
  'PylonApi',
  'Reddit',
  'Salesforce',
  'Search',
  'Sharepoint',
  'Slack',
  'SlackApi',
  'Spotify',
  'SquareupApi',
  'Stripe',
  'StripeApi',
  'TicktickApi',
  'TrelloApi',
  'VercelApi',
  'Walmart',
  'WeaviateApi',
  'Web',
  'X',
  'XeroApi',
  'Youtube',
  'Zendesk',
  'ZohoBooksApi',
  'Zoom',
] as const;

/**
 * Auth requirements for each Arcade toolkit.
 * - oauth: Requires user authorization via OAuth popup
 * - secret: Requires API key configured in Arcade dashboard
 * Updated: 2025-01-15
 */
const ARCADE_TOOLKIT_AUTH: Record<string, { type: 'oauth' | 'secret'; provider?: string; secretKey?: string }> = {
  AirtableApi: { type: 'oauth', provider: 'airtable' },
  ArcadeEngineApi: { type: 'secret', secretKey: 'ARCADE_API_KEY' },
  Asana: { type: 'oauth', provider: 'asana' },
  AsanaApi: { type: 'oauth', provider: 'asana' },
  AshbyApi: { type: 'secret', secretKey: 'ASHBY_API_KEY' },
  Brightdata: { type: 'secret', secretKey: 'BRIGHTDATA_API_KEY' },
  CalendlyApi: { type: 'oauth', provider: 'calendly' },
  Clickup: { type: 'oauth', provider: 'clickup' },
  ClickupApi: { type: 'oauth', provider: 'clickup' },
  CodeSandbox: { type: 'secret', secretKey: 'E2B_API_KEY' },
  Confluence: { type: 'oauth', provider: 'atlassian' },
  CursorAgentsApi: { type: 'secret', secretKey: 'CURSOR_AGENTS_API_KEY' },
  CustomerioApi: { type: 'secret', secretKey: 'CUSTOMERIO_API_KEY' },
  CustomerioPipelinesApi: { type: 'secret', secretKey: 'CUSTOMERIO_TRACK_API_KEY' },
  CustomerioTrackApi: { type: 'secret', secretKey: 'CUSTOMERIO_SITE_ID' },
  DatadogApi: { type: 'secret', secretKey: 'DATADOG_API_KEY' },
  Dropbox: { type: 'oauth', provider: 'dropbox' },
  E2b: { type: 'secret', secretKey: 'E2B_API_KEY' },
  ExaApi: { type: 'secret', secretKey: 'EXA_API_KEY' },
  Figma: { type: 'oauth', provider: 'figma' },
  FigmaApi: { type: 'oauth', provider: 'figma' },
  Firecrawl: { type: 'secret', secretKey: 'FIRECRAWL_API_KEY' },
  FreshserviceApi: { type: 'secret', secretKey: 'FRESHSERVICE_SUBDOMAIN' },
  Github: { type: 'oauth', provider: 'github' },
  GithubApi: { type: 'oauth', provider: 'github' },
  Gmail: { type: 'oauth', provider: 'google' },
  Google: { type: 'oauth', provider: 'google' },
  GoogleCalendar: { type: 'oauth', provider: 'google' },
  GoogleContacts: { type: 'oauth', provider: 'google' },
  GoogleDocs: { type: 'oauth', provider: 'google' },
  GoogleDrive: { type: 'oauth', provider: 'google' },
  GoogleFinance: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleFlights: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleHotels: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleJobs: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleMaps: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleNews: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleSearch: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleSheets: { type: 'oauth', provider: 'google' },
  GoogleShopping: { type: 'secret', secretKey: 'SERP_API_KEY' },
  GoogleSlides: { type: 'oauth', provider: 'google' },
  Hubspot: { type: 'oauth', provider: 'hubspot' },
  HubspotAutomationApi: { type: 'oauth', provider: 'hubspot' },
  HubspotCmsApi: { type: 'oauth', provider: 'hubspot' },
  HubspotConversationsApi: { type: 'oauth', provider: 'hubspot' },
  HubspotCrmApi: { type: 'oauth', provider: 'hubspot' },
  HubspotEventsApi: { type: 'oauth', provider: 'hubspot' },
  HubspotMarketingApi: { type: 'oauth', provider: 'hubspot' },
  HubspotMeetingsApi: { type: 'oauth', provider: 'hubspot' },
  HubspotUsersApi: { type: 'oauth', provider: 'hubspot' },
  Imgflip: { type: 'secret', secretKey: 'IMGFLIP_USERNAME' },
  IntercomApi: { type: 'secret', secretKey: 'INTERCOM_API_SUBDOMAIN' },
  Jira: { type: 'oauth', provider: 'atlassian' },
  Linear: { type: 'oauth', provider: 'linear' },
  Linkedin: { type: 'oauth', provider: 'linkedin' },
  LumaApi: { type: 'secret', secretKey: 'LUMA_API_KEY' },
  MailchimpMarketingApi: { type: 'oauth', provider: 'mailchimp' },
  Microsoft: { type: 'oauth', provider: 'microsoft' },
  MicrosoftTeams: { type: 'oauth', provider: 'microsoft' },
  MiroApi: { type: 'oauth', provider: 'miro' },
  NotionToolkit: { type: 'oauth', provider: 'notion' },
  OutlookCalendar: { type: 'oauth', provider: 'microsoft' },
  OutlookMail: { type: 'oauth', provider: 'microsoft' },
  Pagerduty: { type: 'oauth', provider: 'pagerduty' },
  PagerdutyApi: { type: 'oauth', provider: 'pagerduty' },
  PosthogApi: { type: 'secret', secretKey: 'POSTHOG_SERVER_URL' },
  Pylon: { type: 'secret', secretKey: 'PYLON_API_TOKEN' },
  PylonApi: { type: 'secret', secretKey: 'PYLON_SECRET_TOKEN' },
  Reddit: { type: 'oauth', provider: 'reddit' },
  Salesforce: { type: 'secret', secretKey: 'SALESFORCE_ORG_SUBDOMAIN' },
  Search: { type: 'secret', secretKey: 'SERP_API_KEY' },
  Sharepoint: { type: 'oauth', provider: 'microsoft' },
  Slack: { type: 'oauth', provider: 'slack' },
  SlackApi: { type: 'oauth', provider: 'slack' },
  Spotify: { type: 'oauth', provider: 'spotify' },
  SquareupApi: { type: 'oauth', provider: 'squareup' },
  Stripe: { type: 'secret', secretKey: 'STRIPE_SECRET_KEY' },
  StripeApi: { type: 'secret', secretKey: 'STRIPE_API_KEY' },
  TicktickApi: { type: 'secret', secretKey: 'TICKTICK_API_KEY' },
  TrelloApi: { type: 'secret', secretKey: 'TRELLO_API_KEY' },
  VercelApi: { type: 'secret', secretKey: 'VERCEL_ACCESS_TOKEN' },
  Walmart: { type: 'secret', secretKey: 'SERP_API_KEY' },
  WeaviateApi: { type: 'secret', secretKey: 'WEAVIATE_API_KEY' },
  Web: { type: 'secret', secretKey: 'FIRECRAWL_API_KEY' },
  X: { type: 'oauth', provider: 'x' },
  Youtube: { type: 'secret', secretKey: 'SERP_API_KEY' },
  Zendesk: { type: 'secret', secretKey: 'ZENDESK_SUBDOMAIN' },
  ZohoBooksApi: { type: 'secret', secretKey: 'ZOHO_SERVER_URL' },
  Zoom: { type: 'oauth', provider: 'zoom' },
};

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
   * Uses a static list of known toolkits to avoid the expensive operation of
   * fetching all 7000+ tools just to discover toolkit names.
   */
  async listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    if (!this.apiKey) {
      throw new Error('ARCADE_API_KEY is not configured');
    }

    // Use static toolkit list with auth info - much faster than fetching all tools
    let toolkits: ProviderToolkit[] = ARCADE_TOOLKITS.map(slug => {
      const authInfo = ARCADE_TOOLKIT_AUTH[slug];
      return {
        slug,
        name: this.formatToolkitName(slug),
        description: `${this.formatToolkitName(slug)} tools from Arcade`,
        metadata: {
          source: 'arcade',
          // Auth requirements
          authType: authInfo?.type, // 'oauth' | 'secret' | undefined
          authProvider: authInfo?.type === 'oauth' ? authInfo.provider : undefined,
          secretKey: authInfo?.type === 'secret' ? authInfo.secretKey : undefined,
        },
      };
    });

    // Apply search filter if provided
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      toolkits = toolkits.filter(
        toolkit =>
          toolkit.name.toLowerCase().includes(searchLower) ||
          toolkit.slug.toLowerCase().includes(searchLower),
      );
    }

    // Simple pagination
    const limit = options?.limit || 100;
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
   * Initiate authorization for a toolkit that requires OAuth
   *
   * @param toolkitSlug - The toolkit slug (e.g., "Google", "Github")
   * @param userId - The user ID for the authorization context
   * @returns Authorization response with URL if auth is needed
   */
  async authorize(
    toolkitSlug: string,
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

    // Extract toolkit from tool name if it contains a dot (e.g., "Google.Authorization" -> "Google")
    const toolkit = toolkitSlug.includes('.') ? toolkitSlug.split('.')[0] : toolkitSlug;

    // First, fetch a tool from this toolkit to get its auth requirements
    const toolsResponse = await this.listTools({ toolkitSlug: toolkit, limit: 1 });
    const sampleTool = toolsResponse.tools[0];

    if (!sampleTool) {
      throw new Error(`No tools found for toolkit: ${toolkit}`);
    }

    // Get auth requirements from the tool's metadata
    const authInfo = sampleTool.metadata?.authorization as {
      providerId?: string;
      providerType?: string;
      scopes?: string[];
    } | undefined;

    if (!authInfo?.providerId) {
      throw new Error(`Toolkit ${toolkit} does not require OAuth authorization`);
    }

    const url = `${this.baseUrl}/v1/auth/authorize`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        auth_requirement: {
          provider_id: authInfo.providerId,
          provider_type: authInfo.providerType || 'oauth2',
          oauth2: {
            scopes: authInfo.scopes || [],
          },
        },
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
