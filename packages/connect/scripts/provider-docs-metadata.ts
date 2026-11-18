/**
 * Curated documentation metadata for Connect providers. This file is the
 * single owner of provider display names, logos, shared notes, canonical
 * integration pages, and which documentation outputs the generator emits.
 *
 * Tool IDs and descriptions are never listed here: generate-provider-docs.ts
 * reads them from the toolsets in src/providers.
 *
 * Logos use the same sources as the docs integrations sidebar
 * (docs/src/content/en/integrations/sidebars.js): Simple Icons by slug, with
 * `src` overrides (svgl.app, or the platform catalog) for marks Simple Icons
 * lacks. `mono: true` marks single-color logos that the ProviderLogo
 * component tints for light/dark themes.
 */

export type Logo = { slug?: string; src?: string; mono?: boolean };

/**
 * - `generated-page`: the generator owns the whole integration page at `canonicalPage`.
 * - `handwritten-with-partial`: the integration page is authored by hand and imports a
 *   generated partial from docs/src/components/connect/generated/<provider-id>.mdx.
 */
export type Ownership = 'generated-page' | 'handwritten-with-partial';

export interface ProviderDocs {
  /** Display name used in headings and links. */
  name: string;
  logo?: Logo;
  /** Integration page that owns this provider, relative to docs/src/content/en/integrations. */
  canonicalPage: string;
  ownership: Ownership;
  /**
   * Integrations sidebar category that lists a generated page, used in its title
   * ("<name> | <category>"). Required for emitted `generated-page` providers. The sidebar
   * itself stays hand-maintained in docs/src/content/en/integrations/sidebars.js.
   */
  category?: string;
  /**
   * What the provider's tools let an agent do, as a lowercase verb phrase that completes
   * "Give agents tools to …". Required for every emitted output.
   */
  summary?: string;
  /** Explicit output allowlist: only providers with `emit: true` produce a page or partial. */
  emit?: boolean;
  /** Security concern or destructive consequence shown as a warning in the provider's page or partial. */
  warning?: string;
}

export interface ToolProviderDocs extends ProviderDocs {
  /** Account or capability limit shown in the reference and in the provider's page or partial. */
  note?: string;
}

export interface McpProviderDocs extends ProviderDocs {
  /** The provider's own documentation for its hosted MCP server. */
  mcpDocsUrl: string;
  mcpDocsLabel: string;
}

export interface ChannelConnectionDocs {
  name: string;
  canonicalPage: string;
}

/** Providers present in src/providers but not part of the documented release. */
export const EXCLUDED_PROVIDERS: ReadonlySet<string> = new Set([
  'anthropic',
  'google-analytics',
  'stripe',
  'twitter-v2',
]);

/** Shared Connect setup that every generated page links to as its prerequisite. */
export const CONNECT_GUIDE_PATH = '/docs/mastra-platform/connect';

/** Providers with a generated toolset in src/providers. Keys are provider IDs. */
export const TOOL_PROVIDERS: Record<string, ToolProviderDocs> = {
  clerk: {
    name: 'Clerk',
    logo: { slug: 'clerk', mono: true },
    canonicalPage: 'auth/clerk.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'manage users, organizations, memberships, invitations, roles, and sessions',
    emit: true,
  },
  discord: {
    name: 'Discord',
    logo: { slug: 'discord' },
    canonicalPage: 'channels/discord.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'send and manage messages, and manage channels, threads, roles, members, and webhooks',
    emit: true,
  },
  fireflies: {
    name: 'Fireflies.ai',
    logo: { src: 'https://app.nango.dev/images/template-logos/fireflies.svg' },
    canonicalPage: 'other/fireflies.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary:
      'read meeting transcripts and analytics, ask questions about meetings, create soundbites, and manage meeting sharing and privacy',
    emit: true,
  },
  github: {
    name: 'GitHub',
    logo: { slug: 'github', mono: true },
    canonicalPage: 'channels/github.mdx',
    ownership: 'handwritten-with-partial',
    summary:
      'search code and repositories, manage issues, pull requests, branches, files, and releases, and inspect and rerun workflow runs',
    emit: true,
  },
  'google-calendar': {
    name: 'Google Calendar',
    logo: { slug: 'googlecalendar' },
    canonicalPage: 'email-calendar/google-calendar.mdx',
    ownership: 'generated-page',
    category: 'Email / Calendar',
    summary: 'find, create, and update events, check availability, and manage calendars',
    emit: true,
  },
  'google-docs': {
    name: 'Google Docs',
    logo: { slug: 'googledocs' },
    canonicalPage: 'documents/google-docs.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'create documents, insert and replace text, and edit tables, headers, footers, and styles',
    emit: true,
  },
  'google-drive': {
    name: 'Google Drive',
    logo: { slug: 'googledrive' },
    canonicalPage: 'file-storage/google-drive.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'find, upload, copy, move, and export files, and manage folders, comments, permissions, and shared drives',
    emit: true,
  },
  'google-mail': {
    name: 'Gmail',
    logo: { slug: 'gmail' },
    canonicalPage: 'email-calendar/google-mail.mdx',
    ownership: 'generated-page',
    category: 'Email / Calendar',
    summary: 'read, send, and draft email, manage labels, filters, and threads, and update mailbox settings',
    emit: true,
  },
  'google-sheet': {
    name: 'Google Sheets',
    logo: { slug: 'googlesheets' },
    canonicalPage: 'documents/google-sheet.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'read, append, update, and clear cell values, and create spreadsheets, rows, and worksheets',
    emit: true,
  },
  hubspot: {
    name: 'HubSpot',
    logo: { slug: 'hubspot' },
    canonicalPage: 'crm/hubspot.mdx',
    ownership: 'generated-page',
    category: 'CRM',
    summary:
      'search, create, and update contacts, companies, deals, and tickets, and manage notes, tasks, and marketing emails',
    emit: true,
  },
  'incident-io': {
    name: 'incident.io',
    logo: { src: 'https://app.nango.dev/images/template-logos/incident-io.svg' },
    canonicalPage: 'other/incident-io.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary:
      'create and update incidents, manage follow-ups and actions, and read alerts, schedules, and catalog entries',
    emit: true,
  },
  jira: {
    name: 'Jira',
    logo: { slug: 'jira' },
    canonicalPage: 'project-management/jira.mdx',
    ownership: 'generated-page',
    category: 'Project management',
    summary: 'search, create, update, and transition issues, and manage comments, worklogs, and issue links',
    emit: true,
  },
  linear: {
    name: 'Linear',
    logo: { slug: 'linear' },
    canonicalPage: 'project-management/linear.mdx',
    ownership: 'generated-page',
    category: 'Project management',
    summary: 'search, create, and update issues, and manage projects, cycles, comments, and labels',
    emit: true,
  },
  'microsoft-excel': {
    name: 'Microsoft Excel',
    logo: { src: 'https://app.nango.dev/images/template-logos/microsoft-excel.svg' },
    canonicalPage: 'documents/microsoft-excel.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    note: 'Workbook operations, such as worksheets, ranges, tables, charts, and named items, require a work or school account. Personal Microsoft accounts can find, create, list, get, and delete workbook files, but Microsoft Graph rejects workbook operations on personal OneDrive.',
    summary: 'find and create workbooks, read and update ranges, and manage worksheets, tables, and charts',
    emit: true,
  },
  'microsoft-powerpoint': {
    name: 'Microsoft PowerPoint',
    logo: { src: 'https://app.nango.dev/images/template-logos/microsoft-powerpoint.svg' },
    canonicalPage: 'documents/microsoft-powerpoint.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'find, create, copy, and move presentations, read and update their content, and share them',
    emit: true,
  },
  'microsoft-teams': {
    name: 'Microsoft Teams',
    logo: { slug: 'microsoftteams' },
    canonicalPage: 'channels/teams.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'read and send channel and chat messages, and manage teams, channels, chats, and members',
    emit: true,
  },
  'microsoft-word': {
    name: 'Microsoft Word',
    logo: { src: 'https://app.nango.dev/images/template-logos/microsoft-word.svg' },
    canonicalPage: 'documents/microsoft-word.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'find, create, copy, and move Word documents, read and update their content, and share them',
    emit: true,
  },
  outlook: {
    name: 'Microsoft Outlook',
    logo: { src: 'https://app.nango.dev/images/template-logos/outlook.svg' },
    canonicalPage: 'email-calendar/outlook.mdx',
    ownership: 'generated-page',
    category: 'Email / Calendar',
    summary: 'read, send, draft, and reply to email, manage mail folders, and create and update calendar events',
    emit: true,
  },
  notion: {
    name: 'Notion',
    logo: { slug: 'notion', mono: true },
    canonicalPage: 'documents/notion.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'search, read, create, and update pages, append blocks, and query databases and data sources',
    emit: true,
  },
  'one-drive': {
    name: 'OneDrive',
    logo: { src: 'https://app.nango.dev/images/template-logos/one-drive.svg' },
    canonicalPage: 'documents/one-drive.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'search, upload, copy, move, and share files and folders, and manage permissions and versions',
    emit: true,
  },
  openai: {
    name: 'OpenAI',
    logo: { src: 'https://svgl.app/library/openai.svg', mono: true },
    canonicalPage: 'voice/openai.mdx',
    ownership: 'handwritten-with-partial',
    summary:
      'create responses, chat completions, embeddings, images, and moderations, and manage files, batches, and vector stores',
    emit: true,
  },
  posthog: {
    name: 'PostHog',
    logo: { slug: 'posthog' },
    canonicalPage: 'observability/posthog.mdx',
    ownership: 'handwritten-with-partial',
    summary:
      'capture events, run queries, and manage feature flags, experiments, insights, dashboards, cohorts, and surveys',
    emit: true,
  },
  resend: {
    name: 'Resend',
    logo: { slug: 'resend', mono: true },
    canonicalPage: 'other/resend.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary: 'send email and broadcasts, and manage contacts, segments, domains, templates, and webhooks',
    note: "Connect Resend with an API key that has **Full access** permission. A **Sending access** key fails to connect because Mastra checks a new key by listing your domains, which sending access keys can't do.",
    emit: true,
  },
  'sharepoint-online': {
    name: 'SharePoint Online',
    logo: { src: 'https://app.nango.dev/images/template-logos/sharepoint-online.svg' },
    canonicalPage: 'documents/sharepoint-online.mdx',
    ownership: 'generated-page',
    category: 'Documents',
    summary: 'search sites and files, manage lists, list items, and site pages, and share drive items',
    emit: true,
  },
  slack: {
    name: 'Slack',
    logo: { src: 'https://svgl.app/library/slack.svg' },
    canonicalPage: 'channels/slack.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'read conversations, send and schedule messages, and manage channels',
    emit: true,
  },
  snowflake: {
    name: 'Snowflake',
    logo: { slug: 'snowflake' },
    canonicalPage: 'other/snowflake.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary: 'run SQL statements and read their results, and list databases, schemas, tables, warehouses, and roles',
    emit: true,
  },
  supabase: {
    name: 'Supabase',
    logo: { slug: 'supabase' },
    canonicalPage: 'auth/supabase.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'query and change table rows, call database functions, and manage storage buckets, files, and auth users',
    emit: true,
  },
  workos: {
    name: 'WorkOS',
    logo: { src: 'https://svgl.app/library/workos.svg' },
    canonicalPage: 'auth/workos.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'manage organizations, users, memberships, invitations, SSO connections, and directories',
    emit: true,
  },
};

/**
 * Providers that serve tools from a hosted MCP server. They have no generated toolset,
 * so this list is curated from the platform catalog rather than discovered from src/providers.
 */
export const MCP_PROVIDERS: Record<string, McpProviderDocs> = {
  'attio-mcp': {
    name: 'Attio',
    logo: { src: 'https://app.nango.dev/images/template-logos/attio.svg', mono: true },
    canonicalPage: 'crm/attio.mdx',
    ownership: 'generated-page',
    category: 'CRM',
    summary: 'search and update CRM records, notes, tasks, and lists',
    emit: true,
    mcpDocsUrl: 'https://docs.attio.com/mcp/overview',
    mcpDocsLabel: 'Attio MCP',
  },
  'canva-mcp': {
    name: 'Canva',
    logo: { src: 'https://svgl.app/library/canva.svg' },
    canonicalPage: 'other/canva.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary: 'create, edit, search, and export designs',
    emit: true,
    mcpDocsUrl: 'https://www.canva.dev/docs/apps/mcp/',
    mcpDocsLabel: 'Canva MCP',
  },
  'clay-mcp': {
    name: 'Clay',
    logo: { src: 'https://app.nango.dev/images/template-logos/clay-mcp.svg' },
    canonicalPage: 'crm/clay.mdx',
    ownership: 'generated-page',
    category: 'CRM',
    summary: 'find and research people and companies and run workflows',
    emit: true,
    mcpDocsUrl: 'https://university.clay.com/docs/mcp-settings',
    mcpDocsLabel: 'MCP in Clay',
  },
  'neon-mcp': {
    name: 'Neon',
    logo: { slug: 'neon' },
    canonicalPage: 'databases/neon.mdx',
    ownership: 'handwritten-with-partial',
    summary: 'manage projects and branches, run SQL, and plan and apply schema migrations',
    emit: true,
    mcpDocsUrl: 'https://neon.com/docs/ai/neon-mcp-server',
    mcpDocsLabel: 'Neon MCP server',
  },
  'render-mcp': {
    name: 'Render',
    logo: { slug: 'render', mono: true },
    canonicalPage: 'deploy/render.mdx',
    ownership: 'handwritten-with-partial',
    summary:
      'create services and datastores, update environment variables, read logs and metrics, and query Postgres databases',
    emit: true,
    mcpDocsUrl: 'https://render.com/docs/mcp-server',
    mcpDocsLabel: 'Render MCP server',
  },
  'robinhood-mcp': {
    name: 'Robinhood',
    logo: { slug: 'robinhood' },
    canonicalPage: 'other/robinhood.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary: 'read account and market data and place trades',
    emit: true,
    warning:
      'These tools can place real trades with real money. Require approval for trading tools with `requireApproval` so a person confirms each order before it runs. See [MCP providers](/reference/connect/tools#mcp-providers).',
    mcpDocsUrl: 'https://robinhood.com/us/en/support/agentic-trading',
    mcpDocsLabel: 'Agentic Trading',
  },
  'sanity-mcp': {
    name: 'Sanity',
    logo: { slug: 'sanity', mono: true },
    canonicalPage: 'other/sanity.mdx',
    ownership: 'generated-page',
    category: 'Other providers',
    summary: 'query, create, and update content documents',
    emit: true,
    mcpDocsUrl: 'https://www.sanity.io/docs/ai/mcp-server',
    mcpDocsLabel: 'Sanity MCP server',
  },
};

/**
 * Connect channel connections (`integrationId` in src/providers/channels.ts). Channel setup is
 * handwritten on each canonical page; this map only records which page owns the connection.
 */
export const CHANNEL_CONNECTIONS: Record<string, ChannelConnectionDocs> = {
  'slack-channels': { name: 'Slack', canonicalPage: 'channels/slack.mdx' },
  discord: { name: 'Discord', canonicalPage: 'channels/discord.mdx' },
  telegram: { name: 'Telegram', canonicalPage: 'channels/telegram.mdx' },
  'microsoft-teams': { name: 'Microsoft Teams', canonicalPage: 'channels/teams.mdx' },
};
