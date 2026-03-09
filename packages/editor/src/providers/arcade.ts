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

import { Arcade } from '@arcadeai/arcadejs';
import type {
  ToolDefinition,
  ExecuteToolResponse,
  ToolListParams as ArcadeToolListParams,
} from '@arcadeai/arcadejs/resources';
import { toZodToolSet, executeOrAuthorizeZodTool } from '@arcadeai/arcadejs/lib/index';
import type { ZodTool, ToolAuthorizationResponse } from '@arcadeai/arcadejs/lib/index';

export interface ArcadeToolProviderConfig {
  /** Arcade AI API key */
  apiKey: string;
  /** Base URL for the Arcade API (defaults to https://api.arcade.dev) */
  baseURL?: string;
}

/*
 * Pre-seeded catalog of known Arcade toolkits, sourced from the Arcade
 * integrations page and verified against the API.  This avoids the need to
 * paginate through 7 000+ tools just to list toolkit names.
 *
 * The cache is updated at runtime when `listTools()` or `resolveTools()` encounters
 * a toolkit that isn't already present, so newly-added Arcade integrations are
 * picked up automatically.
 */
const KNOWN_TOOLKITS: readonly { slug: string; name: string; description?: string; category?: string }[] = [
  { slug: 'AirtableApi', name: 'Airtable API', category: 'productivity' },
  { slug: 'ArcadeEngineApi', name: 'Arcade Engine API', category: 'development' },
  { slug: 'Asana', name: 'Asana', category: 'productivity' },
  { slug: 'AsanaApi', name: 'Asana API', category: 'productivity' },
  { slug: 'AshbyApi', name: 'Ashby API', category: 'productivity' },
  { slug: 'Attio', name: 'Attio', category: 'sales' },
  { slug: 'BoxApi', name: 'Box API', category: 'productivity' },
  { slug: 'Brightdata', name: 'Bright Data', category: 'development' },
  { slug: 'CalendlyApi', name: 'Calendly API', category: 'productivity' },
  { slug: 'Clickup', name: 'ClickUp', category: 'productivity' },
  { slug: 'ClickupApi', name: 'ClickUp API', category: 'productivity' },
  { slug: 'Confluence', name: 'Confluence', category: 'productivity' },
  { slug: 'CursorAgentsApi', name: 'Cursor Agents API', category: 'development' },
  { slug: 'CustomerioApi', name: 'Customer.io API', category: 'customer-support' },
  { slug: 'CustomerioPipelinesApi', name: 'Customer.io Pipelines API', category: 'customer-support' },
  { slug: 'CustomerioTrackApi', name: 'Customer.io Track API', category: 'customer-support' },
  { slug: 'DatadogApi', name: 'Datadog API', category: 'development' },
  { slug: 'Dropbox', name: 'Dropbox', category: 'productivity' },
  { slug: 'E2b', name: 'E2B', category: 'development' },
  { slug: 'ExaApi', name: 'Exa API', category: 'search' },
  { slug: 'Figma', name: 'Figma', category: 'productivity' },
  { slug: 'FigmaApi', name: 'Figma API', category: 'productivity' },
  { slug: 'Firecrawl', name: 'Firecrawl', category: 'development' },
  { slug: 'FreshserviceApi', name: 'Freshservice API', category: 'customer-support' },
  { slug: 'Github', name: 'GitHub', category: 'development' },
  { slug: 'GithubApi', name: 'GitHub API', category: 'development' },
  { slug: 'Gmail', name: 'Gmail', category: 'productivity' },
  { slug: 'Google', name: 'Google', category: 'search' },
  { slug: 'GoogleCalendar', name: 'Google Calendar', category: 'productivity' },
  { slug: 'GoogleContacts', name: 'Google Contacts', category: 'productivity' },
  { slug: 'GoogleDocs', name: 'Google Docs', category: 'productivity' },
  { slug: 'GoogleDrive', name: 'Google Drive', category: 'productivity' },
  { slug: 'GoogleFinance', name: 'Google Finance', category: 'search' },
  { slug: 'GoogleFlights', name: 'Google Flights', category: 'search' },
  { slug: 'GoogleHotels', name: 'Google Hotels', category: 'search' },
  { slug: 'GoogleJobs', name: 'Google Jobs', category: 'search' },
  { slug: 'GoogleMaps', name: 'Google Maps', category: 'search' },
  { slug: 'GoogleNews', name: 'Google News', category: 'search' },
  { slug: 'GoogleSearch', name: 'Google Search', category: 'search' },
  { slug: 'GoogleSheets', name: 'Google Sheets', category: 'productivity' },
  { slug: 'GoogleShopping', name: 'Google Shopping', category: 'search' },
  { slug: 'GoogleSlides', name: 'Google Slides', category: 'productivity' },
  { slug: 'Hubspot', name: 'HubSpot', category: 'sales' },
  { slug: 'HubspotAutomationApi', name: 'HubSpot Automation API', category: 'sales' },
  { slug: 'HubspotCmsApi', name: 'HubSpot CMS API', category: 'sales' },
  { slug: 'HubspotConversationsApi', name: 'HubSpot Conversations API', category: 'sales' },
  { slug: 'HubspotCrmApi', name: 'HubSpot CRM API', category: 'sales' },
  { slug: 'HubspotEventsApi', name: 'HubSpot Events API', category: 'sales' },
  { slug: 'HubspotMarketingApi', name: 'HubSpot Marketing API', category: 'sales' },
  { slug: 'HubspotMeetingsApi', name: 'HubSpot Meetings API', category: 'sales' },
  { slug: 'HubspotUsersApi', name: 'HubSpot Users API', category: 'sales' },
  { slug: 'Imgflip', name: 'Imgflip', category: 'entertainment' },
  { slug: 'IntercomApi', name: 'Intercom API', category: 'customer-support' },
  { slug: 'Jira', name: 'Jira', category: 'productivity' },
  { slug: 'Linear', name: 'Linear', category: 'productivity' },
  { slug: 'Linkedin', name: 'LinkedIn', category: 'social' },
  { slug: 'LumaApi', name: 'Luma API', category: 'productivity' },
  { slug: 'MailchimpMarketingApi', name: 'Mailchimp API', category: 'productivity' },
  { slug: 'Math', name: 'Math', category: 'utility' },
  { slug: 'Microsoft', name: 'Microsoft', category: 'productivity' },
  { slug: 'MicrosoftOnedrive', name: 'Microsoft OneDrive', category: 'productivity' },
  { slug: 'MicrosoftTeams', name: 'Microsoft Teams', category: 'social' },
  { slug: 'MicrosoftWord', name: 'Microsoft Word', category: 'productivity' },
  { slug: 'MiroApi', name: 'Miro API', category: 'productivity' },
  { slug: 'NotionToolkit', name: 'Notion', category: 'productivity' },
  { slug: 'OutlookCalendar', name: 'Outlook Calendar', category: 'productivity' },
  { slug: 'OutlookMail', name: 'Outlook Mail', category: 'productivity' },
  { slug: 'Pagerduty', name: 'PagerDuty', category: 'development' },
  { slug: 'PagerdutyApi', name: 'PagerDuty API', category: 'development' },
  { slug: 'PosthogApi', name: 'PostHog API', category: 'development' },
  { slug: 'Pylon', name: 'Pylon', category: 'customer-support' },
  { slug: 'PylonApi', name: 'Pylon API', category: 'customer-support' },
  { slug: 'Reddit', name: 'Reddit', category: 'social' },
  { slug: 'Salesforce', name: 'Salesforce', category: 'sales' },
  { slug: 'Sharepoint', name: 'Microsoft SharePoint', category: 'productivity' },
  { slug: 'Slack', name: 'Slack', category: 'social' },
  { slug: 'SlackApi', name: 'Slack API', category: 'social' },
  { slug: 'Spotify', name: 'Spotify', category: 'entertainment' },
  { slug: 'SquareupApi', name: 'SquareUp API', category: 'productivity' },
  { slug: 'Stripe', name: 'Stripe', category: 'payments' },
  { slug: 'StripeApi', name: 'Stripe API', category: 'payments' },
  { slug: 'TicktickApi', name: 'TickTick API', category: 'productivity' },
  { slug: 'TrelloApi', name: 'Trello API', category: 'productivity' },
  { slug: 'Twilio', name: 'Twilio', category: 'social' },
  { slug: 'VercelApi', name: 'Vercel API', category: 'development' },
  { slug: 'Walmart', name: 'Walmart', category: 'search' },
  { slug: 'WeaviateApi', name: 'Weaviate API', category: 'development' },
  { slug: 'X', name: 'X', category: 'social' },
  { slug: 'XeroApi', name: 'Xero API', category: 'productivity' },
  { slug: 'Youtube', name: 'Youtube', category: 'search' },
  { slug: 'Zendesk', name: 'Zendesk', category: 'customer-support' },
  { slug: 'ZohoBooksApi', name: 'Zoho Books API', category: 'payments' },
  { slug: 'Zoom', name: 'Zoom', category: 'social' },
] as const;

/**
 * Arcade AI tool provider adapter.
 *
 * Uses `@arcadeai/arcadejs` SDK for discovery and runtime tool resolution.
 * The SDK is a static import and tree-shaken if this provider class isn't used.
 *
 * Arcade tools use `Toolkit.ToolName` naming (e.g., `Github.GetRepository`).
 * Each toolkit groups related tools and manages its own auth requirements.
 *
 * Discovery methods (`listToolkits`, `listTools`, `getToolSchema`) use the
 * standard `tools.list()` / `tools.get()` SDK methods.
 *
 * Runtime method (`resolveTools`) uses `toZodToolSet` from `@arcadeai/arcadejs/lib`
 * to get executable ZodTool objects, then converts them to Mastra's ToolAction format.
 */
export class ArcadeToolProvider implements ToolProvider {
  readonly info: ToolProviderInfo = {
    id: 'arcade',
    name: 'Arcade AI',
    description: 'Access 7,000+ tools from 130+ app integrations via Arcade AI',
  };

  private config: ArcadeToolProviderConfig;
  private toolkitCache: Map<string, ToolProviderToolkit>;
  private client: Arcade | null = null;

  constructor(config: ArcadeToolProviderConfig) {
    this.config = config;
    this.toolkitCache = new Map();
    for (const tk of KNOWN_TOOLKITS) {
      this.toolkitCache.set(tk.slug, {
        slug: tk.slug,
        name: tk.name,
        description: tk.description ?? `Arcade AI ${tk.name} tools`,
        icon: tk.category,
      });
    }
  }

  /**
   * Get or create an Arcade client.
   */
  private getClient(): Arcade {
    if (!this.client) {
      this.client = new Arcade({
        apiKey: this.config.apiKey,
        ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
      });
    }
    return this.client;
  }

  /**
   * Absorb toolkit metadata from a tool listing into the cache.
   * Returns true if any new toolkit was discovered.
   */
  private absorbToolkits(items: ToolDefinition[]): boolean {
    let discovered = false;
    for (const tool of items) {
      const tk = tool.toolkit;
      if (tk?.name && !this.toolkitCache.has(tk.name)) {
        this.toolkitCache.set(tk.name, {
          slug: tk.name,
          name: tk.name,
          description: tk.description ?? `Arcade AI ${tk.name} tools`,
        });
        discovered = true;
      }
    }
    return discovered;
  }

  /**
   * List toolkits.
   *
   * Returns the pre-seeded catalog merged with any toolkits discovered at
   * runtime via `listTools()` or `resolveTools()` calls.
   */
  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    const data = [...this.toolkitCache.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { data };
  }

  /**
   * List available tools with optional toolkit and pagination filters.
   * Uses `tools.list({ toolkit, limit, offset })`.
   */
  async listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    const client = this.getClient();

    const limit = options?.perPage ?? 50;
    const page = options?.page ?? 1;
    const offset = (page - 1) * limit;

    const query: ArcadeToolListParams = { limit, offset };
    if (options?.toolkit) query.toolkit = options.toolkit;

    const result = await client.tools.list(query);
    const items: ToolDefinition[] = result.items ?? [];

    // Update toolkit cache with any newly-discovered toolkits
    this.absorbToolkits(items);

    let filtered: ToolDefinition[] = items;
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      filtered = items.filter(
        t =>
          t.name?.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower) ||
          t.qualified_name?.toLowerCase().includes(searchLower),
      );
    }

    const data: ToolProviderToolInfo[] = filtered.map(tool => ({
      slug: tool.qualified_name ?? `${tool.toolkit?.name}.${tool.name}`,
      name: tool.name,
      description: tool.description,
      toolkit: tool.toolkit?.name,
    }));

    return {
      data,
      pagination: {
        page,
        perPage: limit,
        total: result.total_count,
        hasMore: offset + items.length < (result.total_count ?? 0),
      },
    };
  }

  /**
   * Get the JSON schema for a specific tool by its qualified name (e.g., `Github.GetRepository`).
   */
  async getToolSchema(toolSlug: string): Promise<Record<string, unknown> | null> {
    try {
      const client = this.getClient();
      const tool: ToolDefinition = await client.tools.get(toolSlug);
      if (!tool) return null;

      // Convert Arcade's parameter array to a JSON Schema-like object
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];

      for (const param of tool.input?.parameters ?? []) {
        properties[param.name] = {
          ...(param.value_schema ?? {}),
          description: param.description,
        };
        if (param.required) required.push(param.name);
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolve executable tools in Mastra's ToolAction format.
   *
   * Uses `toZodToolSet` from `@arcadeai/arcadejs/lib` to create ZodTool objects
   * with Zod schemas and execute functions, then wraps them as ToolAction objects.
   */
  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<unknown, unknown>>> {
    if (toolSlugs.length === 0) return {};

    const client = this.getClient();
    const userId = (options?.userId as string) ?? 'default';

    // Fetch tool definitions for the requested slugs
    const toolDefs = await Promise.all(toolSlugs.map(slug => client.tools.get(slug).catch(() => null)));
    const validDefs: ToolDefinition[] = toolDefs.filter((d): d is ToolDefinition => d !== null);

    if (validDefs.length === 0) return {};

    // Update toolkit cache with any newly-discovered toolkits
    this.absorbToolkits(validDefs);

    // Convert to executable ZodTool objects using Arcade's helper
    const zodToolSet: Record<string, ZodTool<ExecuteToolResponse | ToolAuthorizationResponse>> = toZodToolSet({
      tools: validDefs,
      client,
      userId,
      executeFactory: executeOrAuthorizeZodTool,
    });

    // Convert ZodTool objects to Mastra ToolAction format
    const result: Record<string, ToolAction<unknown, unknown>> = {};

    // Build a lookup from normalized name (Github_GetRepository) to qualified name (Github.GetRepository)
    const normalizedToQualified = new Map<string, string>();
    for (const d of validDefs) {
      const qn = d.qualified_name ?? `${d.toolkit?.name}.${d.name}`;
      normalizedToQualified.set(qn.replace(/\./g, '_'), qn);
    }

    for (const [key, zodTool] of Object.entries(zodToolSet)) {
      const qualifiedName = normalizedToQualified.get(key) ?? key;
      const descOverride = toolConfigs?.[qualifiedName]?.description ?? toolConfigs?.[key]?.description;

      // Arcade SDK bundles a different Zod minor version than Mastra, so the
      // schema types are structurally identical at runtime but nominally
      // incompatible in TS.  Cast through `unknown` to bridge the gap.
      result[qualifiedName] = {
        id: qualifiedName,
        description: descOverride ?? zodTool.description ?? '',
        inputSchema: zodTool.parameters as unknown as ToolAction<unknown, unknown>['inputSchema'],
        outputSchema: zodTool.output as unknown as ToolAction<unknown, unknown>['outputSchema'],
        execute: async (input: unknown) => {
          return zodTool.execute(input);
        },
      };
    }

    return result;
  }
}
