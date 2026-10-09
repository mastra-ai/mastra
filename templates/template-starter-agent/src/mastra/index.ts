import { channels } from '@mastra/connect';
import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { PinoLogger } from '@mastra/loggers';
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import { PostgresStore } from '@mastra/pg';
import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';
import { agent, hasConnectEnv } from './agents/agent';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';
import { seedWelcomeThread } from './welcome';
import { activityDigestWorkflow } from './workflows/activity-digest';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Provide a Postgres connection string.');
}

// Channel providers derive OAuth redirect and webhook URLs from the server
// config, and the bind address of a deployed container (e.g. 0.0.0.0:3000)
// is not publicly reachable. MASTRA_SERVER_URL carries the server's public
// URL — Mastra Cloud injects it on every deploy; set it yourself on other
// hosts. Once channel providers read the variable directly, this block can
// be removed.
const serverUrl = process.env.MASTRA_SERVER_URL ? new URL(process.env.MASTRA_SERVER_URL) : undefined;

export const mastra = new Mastra({
  ...(serverUrl && {
    server: {
      studioProtocol: serverUrl.protocol === 'https:' ? ('https' as const) : ('http' as const),
      studioHost: serverUrl.hostname,
      studioPort: serverUrl.port ? Number(serverUrl.port) : serverUrl.protocol === 'https:' ? 443 : 80,
    },
  }),
  agents: { agent },
  tools: { startScheduleTool, stopScheduleTool },
  workflows: { activityDigestWorkflow },
  // Chat channels (Slack, Telegram, Discord, …) resolved live from the Mastra
  // platform project's connections; connecting a channel on the platform takes
  // effect without redeploying. Skipped when the platform env isn't configured.
  channels: hasConnectEnv ? await channels() : undefined,
  storage: new PostgresStore({
    id: 'mastra-storage',
    connectionString: databaseUrl,
  }),
  // Studio editing: agent overrides and workflow definitions persist as files
  // under ./mastra/editor (source: 'code'), the workflow builder authors
  // workflows from Studio, and the platform workspace providers let Studio
  // configure PlatformSandbox / PlatformFilesystem workspaces.
  editor: new MastraEditor({
    source: 'code',
    workflowBuilder: { enabled: true },
    filesystems: { [platformFilesystemProvider.id]: platformFilesystemProvider },
    sandboxes: { [platformSandboxProvider.id]: platformSandboxProvider },
  }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'starter-agent',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});

// On the very first boot the agent speaks first: seed a "Welcome" thread that
// introduces its capabilities, lists connected integrations, and explains how
// to edit its system prompt from Studio. No-op once any thread exists.
void seedWelcomeThread(mastra).catch(error => {
  mastra.getLogger()?.warn('Failed to seed welcome thread', { error });
});
