export type IntegrationCatalogEntry = {
  id: string;
  provider: string;
  displayName: string;
  logoUrl: string | null;
  capabilities: { proxy: boolean; webhooks: boolean };
};

const entry = (id: string, displayName: string): IntegrationCatalogEntry => ({
  id,
  provider: id,
  displayName,
  logoUrl: `https://app.nango.dev/images/template-logos/${id}.svg`,
  capabilities: { proxy: true, webhooks: true },
});

export const integrationsCatalog: { integrations: IntegrationCatalogEntry[] } = {
  integrations: [
    entry('anthropic', 'Anthropic'),
    entry('beehiiv', 'Beehiiv'),
    entry('clerk', 'Clerk'),
    entry('cloudflare', 'Cloudflare'),
    entry('elevenlabs', 'Eleven Labs'),
    entry('gitlab-group-token', 'GitLab '),
    entry('hubspot', 'HubSpot'),
    entry('jira', 'Jira'),
    entry('linear', 'Linear'),
    entry('neon', 'Neon'),
    entry('notion', 'Notion'),
    entry('openai', 'OpenAI'),
    entry('render-mcp', 'Render (MCP)'),
    entry('replicate', 'Replicate'),
    entry('resend', 'Resend'),
    entry('sanity-mcp', 'Sanity (MCP)'),
    entry('sendgrid', 'SendGrid'),
    entry('snowflake', 'Snowflake'),
    entry('supabase', 'Supabase'),
    entry('telegram', 'Telegram'),
    entry('workos', 'WorkOS'),
  ],
};
