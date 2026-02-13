import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
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

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

const testScorer = createScorer({
  id: 'scorer1',
  name: 'My Scorer',
  description: 'Scorer 1',
}).generateScore(() => {
  return 1;
});

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
    // Agents with processor workflows from model-v2-agent
    agentWithAdvancedModeration,
    agentWithBranchingModeration,
    agentWithSequentialModeration,
    supervisorAgent,
  },
  processors: {
    moderationProcessor,
    piiDetectionProcessor,
    toxicityCheckProcessor,
    responseQualityProcessor,
    sensitiveTopicBlocker,
    stepLoggerProcessor,
  },
  // logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
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
  server: {
    build: {
      swaggerUI: true,
    },
    apiRoutes: [
      // Example custom route with OpenAPI documentation
      registerApiRoute('/hello/:name', {
        method: 'GET',
        openapi: {
          summary: 'Say hello',
          description: 'Returns a greeting for the given name',
          tags: ['Custom'],
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              description: 'Name to greet',
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Greeting response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        handler: async c => {
          const name = c.req.param('name');
          return c.json({
            message: `Hello, ${name}!`,
            timestamp: new Date().toISOString(),
          });
        },
      }),

      // Example with Zod schema conversion
      registerApiRoute('/items', {
        method: 'POST',
        openapi: {
          summary: 'Create an item',
          description: 'Creates a new item with the provided data',
          tags: ['Custom'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: z.object({
                  name: z.string().describe('Item name'),
                  price: z.number().describe('Item price'),
                }),
              },
            },
          },
          responses: {
            201: {
              description: 'Item created',
              content: {
                'application/json': {
                  schema: z.object({
                    id: z.string(),
                    name: z.string(),
                    price: z.number(),
                    createdAt: z.string(),
                  }),
                },
              },
            },
          },
        },
        handler: async c => {
          const body = await c.req.json();
          return c.json(
            {
              id: crypto.randomUUID(),
              name: body.name,
              price: body.price,
              createdAt: new Date().toISOString(),
            },
            201,
          );
        },
      }),
    ],
  },
  scorers: {
    testScorer,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
};

export const mastra = new Mastra({
  ...config,
  editor: new MastraEditor({
    toolProviders: {
      composio: new ComposioToolProvider({ apiKey: '' }),
    },
  }),
});
