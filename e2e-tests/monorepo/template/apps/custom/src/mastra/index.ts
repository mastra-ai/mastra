import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { innerAgent, browserAgent } from '@/agents';
import { usageAgent } from '@/agents/usage-agent';
import { testRoute } from '@/api/route/test';
import { createRouteRoute } from '@/api/route/create-route';
import { allRoute } from '@/api/route/all';
import { streamingRoute } from '@/api/route/streaming';
import { shutdownDrainRoute } from '@/api/route/shutdown-drain';
import { shutdownDrainWorkflowRoute } from '@/api/route/shutdown-drain-workflow';
import { shutdownDrainWorkflow } from '@/workflows/shutdown-drain';
import { transitiveWorkspaceRoute } from '@/api/route/transitive-workspace';
import { protobufSubpathRoute } from '@/api/route/protobuf-subpath';
import { modelUsageRoute } from '@/api/route/model-usage';
import { myAgent } from '@inner/hello-world/agent';
import { calculatorMcpServer } from '@/mcp';
import 'nodemailer';

if (process.env.NODE_ENV === 'development') {
  void import('date-fns');
}

export const mastra = new Mastra({
  agents: { innerAgent, myAgent, 'browser-agent': browserAgent, usageAgent },
  workflows: { shutdownDrainWorkflow },
  mcpServers: { calculator: calculatorMcpServer },
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 3000,
    apiRoutes: [
      testRoute,
      createRouteRoute,
      allRoute,
      streamingRoute,
      shutdownDrainRoute,
      shutdownDrainWorkflowRoute,
      transitiveWorkspaceRoute,
      protobufSubpathRoute,
      modelUsageRoute,
    ],
  },
  bundler: {
    externals: ['bcrypt', '@inner/subpath-only'],
    pnpmWorkspaceSettings: { blockExoticSubdeps: false },
  },
  // Model token metrics flow through observability; telemetry counts usage from there.
  observability: new Observability({
    configs: { default: { serviceName: 'monorepo-e2e', exporters: [new MastraStorageExporter()] } },
  }),
  logger: new ConsoleLogger({ level: 'info' }),
});
