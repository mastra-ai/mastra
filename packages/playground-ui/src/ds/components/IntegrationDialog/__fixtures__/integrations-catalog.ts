export type IntegrationCatalogEntry = {
  id: string;
  provider: string;
  displayName: string;
  logoUrl: string | null;
  authType: string | null;
  capabilities: { proxy: boolean; webhooks: boolean };
};

const entry = (id: string, displayName: string, authType: string | null = 'OAUTH2'): IntegrationCatalogEntry => ({
  id,
  provider: id,
  displayName,
  logoUrl: `https://app.nango.dev/images/template-logos/${id}.svg`,
  authType,
  capabilities: { proxy: true, webhooks: true },
});

export const integrationsCatalog: { integrations: IntegrationCatalogEntry[] } = {
  integrations: [
    entry('anthropic', 'Anthropic', 'API_KEY'),
    entry('beehiiv', 'Beehiiv', 'API_KEY'),
    entry('clerk', 'Clerk', 'API_KEY'),
    entry('cloudflare', 'Cloudflare', 'API_KEY'),
    entry('elevenlabs', 'Eleven Labs', 'API_KEY'),
    entry('gitlab-group-token', 'GitLab ', 'API_KEY'),
    entry('hubspot', 'HubSpot'),
    entry('jira', 'Jira'),
    entry('linear', 'Linear'),
    entry('neon', 'Neon', 'API_KEY'),
    entry('notion', 'Notion'),
    entry('openai', 'OpenAI', 'API_KEY'),
    entry('render-mcp', 'Render (MCP)', 'MCP_OAUTH2'),
    entry('replicate', 'Replicate', 'API_KEY'),
    entry('resend', 'Resend', 'API_KEY'),
    entry('sanity-mcp', 'Sanity (MCP)', 'MCP_OAUTH2'),
    entry('sendgrid', 'SendGrid', 'API_KEY'),
    entry('snowflake', 'Snowflake', 'BASIC'),
    entry('supabase', 'Supabase'),
    entry('telegram', 'Telegram', 'API_KEY'),
    entry('workos', 'WorkOS', 'API_KEY'),
  ],
};
