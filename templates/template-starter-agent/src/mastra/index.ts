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
import { RedisServerCache } from '@mastra/redis';
import Redis from 'ioredis';
import { agent, hasConnectEnv } from './agents/agent';
import { startScheduleTool, stopScheduleTool } from './tools/schedule-tools';
import { seedWelcomeThread } from './welcome';
import { activityDigestWorkflow } from './workflows/activity-digest';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Provide a Postgres connection string.');
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is not set. Redis backs the event cache so streams survive client disconnects.');
}

export const mastra = new Mastra({
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
  // Redis-backed event cache: agent runs record their chunks here so late
  // subscribers and reconnecting clients can replay missed events.
  cache: new RedisServerCache({ client: new Redis(redisUrl) }),
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
