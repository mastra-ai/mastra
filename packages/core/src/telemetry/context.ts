import { hashTelemetryValue } from './posthog';

export interface ServerTelemetryContext {
  projectId: string;
  distinctId: string | undefined;
  command: string;
  nodeEnv: string;
}

export function getServerTelemetryContext(): ServerTelemetryContext {
  return {
    projectId: hashTelemetryValue(process.env.MASTRA_PROJECT_ROOT || process.cwd()).slice(0, 16),
    distinctId: process.env.MASTRA_CLI_DISTINCT_ID || undefined,
    command: process.env.MASTRA_TELEMETRY_COMMAND || 'server',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
