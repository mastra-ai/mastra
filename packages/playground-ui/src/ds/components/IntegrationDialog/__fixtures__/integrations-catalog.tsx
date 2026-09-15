import type { IntegrationDialogItem } from '../integration-dialog';

const logo = (id: string) => `https://app.nango.dev/images/template-logos/${id}.svg`;

const item = (id: string, name: string, meta: string, badge?: string): IntegrationDialogItem => ({
  id,
  name,
  meta,
  badge,
  logo: <img src={logo(id)} alt="" />,
});

export const integrationsCatalog: IntegrationDialogItem[] = [
  item('anthropic', 'Anthropic', 'API Key'),
  item('beehiiv', 'Beehiiv', 'API Key'),
  item('clerk', 'Clerk', 'API Key'),
  item('cloudflare', 'Cloudflare', 'API Key'),
  item('elevenlabs', 'Eleven Labs', 'API Key'),
  item('gitlab-group-token', 'GitLab', 'API Key'),
  item('hubspot', 'HubSpot', 'OAuth'),
  item('jira', 'Jira', 'OAuth'),
  item('linear', 'Linear', 'OAuth'),
  item('neon', 'Neon', 'API Key'),
  item('notion', 'Notion', 'OAuth'),
  item('openai', 'OpenAI', 'API Key'),
  item('render-mcp', 'Render', 'OAuth', 'MCP'),
  item('replicate', 'Replicate', 'API Key'),
  item('resend', 'Resend', 'API Key'),
  item('sanity-mcp', 'Sanity', 'OAuth', 'MCP'),
  item('sendgrid', 'SendGrid', 'API Key'),
  item('snowflake', 'Snowflake', 'Basic Auth'),
  item('supabase', 'Supabase', 'OAuth'),
  item('telegram', 'Telegram', 'API Key'),
  item('workos', 'WorkOS', 'API Key'),
];
