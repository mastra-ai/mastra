import { CHANNELS, PROVIDERS } from '@mastra/connect';
import type { ChannelsResolver, ToolsResolver } from '@mastra/connect';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const region = process.env.MASTRA_PLATFORM_REGION?.trim().toLowerCase();
const connectClient = {
  accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() || process.env.MASTRA_PLATFORM_SECRET_KEY?.trim(),
  orgId: process.env.MASTRA_ORG_ID?.trim(),
  baseUrl:
    process.env.MASTRA_INTEGRATIONS_API_URL?.trim() ||
    (region === 'us' || region === 'eu'
      ? `https://integrations.${region}.mastra.ai`
      : 'https://integrations.mastra.ai'),
};

const authFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  documentationUrl: z.string().url().nullable(),
  required: z.boolean(),
  secret: z.boolean(),
  options: z.array(z.string()).nullable(),
  visibleWhen: z.object({ field: z.string(), equals: z.string() }).nullable(),
  order: z.number(),
});
const catalogSchema = z.object({
  integrations: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      authType: z.string().nullable(),
      authFields: z.array(authFieldSchema),
      surfaces: z.array(z.string()),
      capabilities: z.object({ proxy: z.boolean(), webhooks: z.boolean(), mcp: z.boolean().optional() }),
      comingSoon: z.boolean(),
    }),
  ),
});
const connectionsSchema = z.object({
  connections: z.array(
    z.object({
      id: z.string(),
      integrationId: z.string(),
      status: z.string(),
      displayName: z.string().nullish(),
      accountLabel: z.string().nullish(),
    }),
  ),
});
const identitySchema = z.object({ teamId: z.string().optional(), projectId: z.string().optional() });
const toolMetadataSchema = z.object({ description: z.string().optional() });

function projectContext() {
  const projectId = process.env.MASTRA_PROJECT_ID?.trim();
  const context = {
    projectId: projectId ?? null,
    agent: { id: 'agent', name: 'Starter Agent' },
    serverUrl: process.env.MASTRA_SERVER_URL?.trim() || null,
  };
  let identity: z.infer<typeof identitySchema> = {};
  const tokenParts = process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim().split('.');
  if (tokenParts?.length === 3) {
    try {
      identity = identitySchema.parse(JSON.parse(Buffer.from(tokenParts[1]!, 'base64url').toString()));
    } catch {
      return { ...context, links: null, linkError: 'The deployment token has no readable project identity.' };
    }
  }
  if (
    (identity.projectId && identity.projectId !== projectId) ||
    (connectClient.orgId && identity.teamId && connectClient.orgId !== identity.teamId)
  ) {
    return { ...context, links: null, linkError: 'The deployment identities do not match.' };
  }
  const orgId = connectClient.orgId || identity.teamId;
  if (!orgId || !projectId) {
    return { ...context, links: null, linkError: 'The deployment is missing organization or project identity.' };
  }
  const overview = new URL(
    `/orgs/${encodeURIComponent(orgId)}/projects/${encodeURIComponent(projectId)}`,
    process.env.MASTRA_PROJECTS_URL?.trim() || 'https://projects.mastra.ai',
  ).href;
  return { ...context, links: { overview, connections: `${overview}/settings/connect` } };
}

async function readMetadata<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const url = new URL(connectClient.baseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`;
  const headers = new Headers({ authorization: `Bearer ${connectClient.accessToken}`, accept: 'application/json' });
  if (connectClient.orgId) headers.set('x-organization-id', connectClient.orgId);
  const response = await fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Platform returned ${response.status}.`);
  return schema.parse(await response.json());
}

async function inspect<T>(read: () => Promise<T>, failure: string) {
  try {
    return { status: 'ready' as const, data: await read() };
  } catch {
    return { status: 'unavailable' as const, reason: failure };
  }
}

export function createListConnectionsTool(
  connectTools: ToolsResolver | undefined,
  getChannels: () => Promise<ChannelsResolver> | undefined,
) {
  return createTool({
    id: 'list_connections',
    description:
      'Check this project’s setup: live integration catalog and auth documentation, attached connections, discovered tools, agent channel installations, and Platform links. Refresh after the user connects. This tool does not connect or install anything.',
    inputSchema: z.object({
      provider: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Filter the catalog by ID or display name. Project state stays complete.'),
      refresh: z.boolean().default(false).describe('Fetch new tool and channel discovery instead of cached results.'),
    }),
    execute: async ({ provider, refresh }, { mastra }) => {
      const project = projectContext();
      if (!connectTools) {
        return { project, configured: false, reason: 'Connect is not configured for this deployment.' };
      }
      const query = provider?.toLowerCase();
      const matches = (id: string, name = id) => !query || `${id} ${name}`.toLowerCase().includes(query);
      const [catalog, connections, toolsets, channelState] = await Promise.all([
        inspect(async () => {
          const { integrations } = await readMetadata('/v2/integrations', catalogSchema);
          return integrations
            .filter(entry => matches(entry.id, entry.displayName))
            .map(entry => ({
              ...entry,
              supported: {
                tools: Boolean(entry.capabilities.mcp) || PROVIDERS.some(item => item.integrationId === entry.id),
                channels: CHANNELS.some(item => item.integrationId === entry.id),
              },
            }));
        }, 'Couldn’t load the integration catalog. Check access to this project’s Connections page.'),
        inspect(async () => {
          const { connections } = await readMetadata(
            `/v2/projects/${encodeURIComponent(project.projectId!)}/connections`,
            connectionsSchema,
          );
          return connections;
        }, 'Couldn’t load this project’s connections. Check access to its Connections page.'),
        inspect(async () => {
          const resolved = refresh ? await connectTools.refresh() : await connectTools({ mastra });
          return Object.entries(resolved).map(([name, tool]) => ({ name, ...toolMetadataSchema.parse(tool) }));
        }, 'Couldn’t discover connected tools. Check the connection status in the project’s Connections page.'),
        inspect(async () => {
          if (!mastra) throw new Error('Channel runtime unavailable.');
          if (refresh) await (await getChannels())?.refresh();
          const resolved = await mastra.resolveChannels();
          return Promise.all(
            Object.entries(resolved).map(async ([id, channel]) => ({
              id,
              configured: channel.getInfo?.().isConfigured ?? false,
              installations:
                (await channel.listInstallations?.())?.filter(install => install.agentId === 'agent') ?? [],
            })),
          );
        }, 'Couldn’t check agent channel installations. Open Studio’s Config panel and check Channels.'),
      ]);
      return { project, configured: true, catalog, connections, tools: toolsets, channels: channelState };
    },
  });
}
