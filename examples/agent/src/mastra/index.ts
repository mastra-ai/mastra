import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraEditor } from '@mastra/editor';

import { mastraAuth, rbacProvider } from './auth';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';
import { ComposioToolProvider } from '@mastra/editor/composio';

import {
  agentThatHarassesYou,
  chefAgent,
  chefAgentResponses,
  dynamicAgent,
  evalAgent,
  dynamicToolsAgent,
  schemaValidatedAgent,
  requestContextDemoAgent,
} from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { lessComplexWorkflow, myWorkflow } from './workflows';
import {
  chefModelV2Agent,
  networkAgent,
  agentWithAdvancedModeration,
  agentWithBranchingModeration,
  agentWithSequentialModeration,
  supervisorAgent,
  subscriptionOrchestratorAgent,
} from './agents/model-v2-agent';
import { createScorer } from '@mastra/core/evals';
import { myWorkflowX, nestedWorkflow, findUserWorkflow } from './workflows/other';
import { moderationProcessor } from './agents/model-v2-agent';
import {
  moderatedAssistantAgent,
  agentWithProcessorWorkflow,
  contentModerationWorkflow,
  simpleAssistantAgent,
  agentWithBranchingWorkflow,
  advancedModerationWorkflow,
} from './workflows/content-moderation';
import {
  piiDetectionProcessor,
  toxicityCheckProcessor,
  responseQualityProcessor,
  sensitiveTopicBlocker,
  stepLoggerProcessor,
} from './processors/index';

const storage = new InMemoryStore();

const config = {
  agents: {
    chefAgent,
    chefAgentResponses,
    dynamicAgent,
    dynamicToolsAgent, // Dynamic tool search example
    agentThatHarassesYou,
    evalAgent,
    schemaValidatedAgent,
    requestContextDemoAgent,
    chefModelV2Agent,
    networkAgent,
    moderatedAssistantAgent,
    agentWithProcessorWorkflow,
    simpleAssistantAgent,
    agentWithBranchingWorkflow,
    agentWithAdvancedModeration,
    agentWithBranchingModeration,
    agentWithSequentialModeration,
    supervisorAgent,
    subscriptionOrchestratorAgent,
  },
  processors: {
    moderationProcessor,
    piiDetectionProcessor,
    toxicityCheckProcessor,
    responseQualityProcessor,
    sensitiveTopicBlocker,
    stepLoggerProcessor,
  },
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: {
    myWorkflow,
    myWorkflowX,
    lessComplexWorkflow,
    nestedWorkflow,
    contentModerationWorkflow,
    advancedModerationWorkflow,
    findUserWorkflow,
  },
  bundler: {
    sourcemap: true,
  },
  editor: new MastraEditor(),
  // server: {
  //   auth: mastraAuth,
  //   rbac: rbacProvider,
  // },
};

const debugInjectMetricsRoute = registerApiRoute('/debug/inject-metrics', {
  method: 'POST',
  createHandler: async ({ mastra: m }) => async (c: any) => {
    const body = await c.req.json();
    const metrics = body.metrics ?? [];
    const store = m.getStorage();
    if (!store) return c.json({ error: 'No storage' }, 500);
    const obsStore = await store.getStore('observability');
    if (!obsStore) return c.json({ error: 'No observability store' }, 500);
    await obsStore.batchCreateMetrics({
      metrics: metrics.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    });
    return c.json({ injected: metrics.length });
  },
});

const debugInjectScoresRoute = registerApiRoute('/debug/inject-scores', {
  method: 'POST',
  createHandler: async ({ mastra: m }) => async (c: any) => {
    const body = await c.req.json();
    const scores = body.scores ?? [];
    const store = m.getStorage();
    if (!store) return c.json({ error: 'No storage' }, 500);
    const scoresStore = await store.getStore('scores');
    if (!scoresStore) return c.json({ error: 'No scores store' }, 500);
    const results = [];
    for (const s of scores) {
      const result = await scoresStore.saveScore(s);
      // Overwrite createdAt directly on the in-memory record
      const saved = result.score as any;
      if (s.createdAt) saved.createdAt = new Date(s.createdAt);
      results.push(result);
    }
    return c.json({ injected: scores.length });
  },
});

export const mastra = new Mastra({
  ...config,
  editor: new MastraEditor({
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '' }),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    apiRoutes: [debugInjectMetricsRoute, debugInjectScoresRoute],
  },
});
