import type { Mastra } from '@mastra/core/mastra';
import type { MastraVector } from '@mastra/core/vector';
import { describe, beforeEach, afterEach, vi } from 'vitest';
import { createExpressRouteExecutor } from './adapter-test-utils';
import { createRouteAdapterTestSuite } from '../../../../packages/server/src/server/server-adapter/routes/__tests__/route-adapter-test-suite';
import type { RouteRequestOverrides } from '../../../../packages/server/src/server/server-adapter/routes/__tests__/route-test-utils';
import type { ServerRoute } from '../../../../packages/server/src/server/server-adapter/routes/index';
import { AGENTS_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/agents';
import { WORKFLOWS_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/workflows';
import { TOOLS_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/tools';
import { MEMORY_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/memory';
import { SCORES_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/scorers';
import { OBSERVABILITY_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/observability';
import { LOGS_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/logs';
import { VECTORS_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/vectors';
import { A2A_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/a2a';
import { AGENT_BUILDER_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/agent-builder';
import { LEGACY_ROUTES } from '../../../../packages/server/src/server/server-adapter/routes/legacy';
import {
  createTestAgent,
  mockAgentMethods,
  createTestMastra,
  setupWorkflowTests,
  setupMemoryTests,
  setupObservabilityTests,
  setupA2ATests,
  setupAgentBuilderTests,
  setupLegacyTests,
  createTestTool,
} from '../../../../packages/server/src/server/server-adapter/routes/__tests__/test-helpers';

interface SuiteConfig {
  name: string;
  routes: ServerRoute[];
  setup: () => Promise<{
    mastra: Mastra;
    tools?: Record<string, any>;
    taskStore?: any;
    buildRequestOverrides?: (route: any) => RouteRequestOverrides;
  }> | {
    mastra: Mastra;
    tools?: Record<string, any>;
    taskStore?: any;
    buildRequestOverrides?: (route: any) => RouteRequestOverrides;
  };
  skipRoute?: (route: any) => boolean;
}

const SUITES: SuiteConfig[] = [
  {
    name: 'Agent Routes',
    routes: AGENTS_ROUTES,
    setup: () => {
      const agent = createTestAgent();
      mockAgentMethods(agent);
      const mastra = createTestMastra({
        agents: { 'test-agent': agent },
      });
      return { mastra };
    },
  },
  {
    name: 'Workflow Routes',
    routes: WORKFLOWS_ROUTES,
    setup: async () => {
      const { mastra } = await setupWorkflowTests();
      return { mastra };
    },
  },
  {
    name: 'Tool Routes',
    routes: TOOLS_ROUTES,
    setup: () => {
      const testTool = createTestTool();
      const tools = { 'test-tool': testTool };
      const mastra = createTestMastra({ tools });
      return { mastra, tools };
    },
  },
  {
    name: 'Memory Routes',
    routes: MEMORY_ROUTES,
    setup: async () => {
      const { mastra } = await setupMemoryTests();
      return {
        mastra,
        buildRequestOverrides: (route: ServerRoute) => {
          if (route.method === 'POST' && route.path === '/api/memory/messages') {
            return {
              body: {
                messages: [],
              },
            };
          }
          return {};
        },
      };
    },
  },
  {
    name: 'Scores Routes',
    routes: SCORES_ROUTES,
    setup: async () => {
      const agent = createTestAgent();
      mockAgentMethods(agent);
      vi.spyOn(agent, 'listScorers').mockResolvedValue({
        'test-scorer': {
          scorer: { id: 'test-scorer', name: 'Test Scorer', description: 'Test scorer' },
        },
      } as any);

      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        __registerMastra: vi.fn(),
        __registerPrimitives: vi.fn(),
        listScorers: vi.fn().mockResolvedValue({}),
      } as any;

      const mockScore = {
        id: 'score-1',
        runId: 'test-run',
        scorerId: 'test-scorer',
        traceId: 'test-trace-test-span',
        entityId: 'test-agent',
        entityType: 'AGENT',
        score: 0.9,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const storageMock = {
        __setLogger: vi.fn(),
        init: vi.fn().mockResolvedValue(undefined),
        listScoresByRunId: vi.fn().mockResolvedValue({
          pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
          scores: [
            {
              ...mockScore,
            },
          ],
        }),
        listScoresByScorerId: vi.fn().mockResolvedValue({
          pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
          scores: [
            {
              ...mockScore,
            },
          ],
        }),
        listScoresByEntityId: vi.fn().mockResolvedValue({
          pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
          scores: [
            {
              ...mockScore,
            },
          ],
        }),
        saveScore: vi.fn().mockResolvedValue({
          score: { ...mockScore },
        }),
      };

      const mastra = createTestMastra({
        agents: { 'test-agent': agent },
        workflows: { 'test-workflow': workflow },
        storage: storageMock as any,
      });

      vi.spyOn(mastra, 'listScorers').mockResolvedValue({
        'test-scorer': { id: 'test-scorer', name: 'Test Scorer', description: 'Test scorer' },
      } as any);

      return {
        mastra,
      };
    },
  },
  {
    name: 'Observability Routes',
    routes: OBSERVABILITY_ROUTES,
    setup: async () => {
      const { mastra } = await setupObservabilityTests();
      return { mastra };
    },
  },
  {
    name: 'Logs Routes',
    routes: LOGS_ROUTES,
    setup: () => {
      const mastra = createTestMastra();
      return { mastra };
    },
  },
  {
    name: 'Vector Routes',
    routes: VECTORS_ROUTES,
    setup: () => {
      const mastra = createTestMastra();
      const vectorMock = {
        upsert: vi.fn().mockResolvedValue(['vector-id-1']),
        createIndex: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([
          {
            id: 'vector-id-1',
            score: 0.95,
            values: [0.1, 0.2, 0.3],
            metadata: {},
          },
        ]),
        listIndexes: vi.fn().mockResolvedValue(['test-index']),
        describeIndex: vi.fn().mockResolvedValue({ dimension: 3, count: 1, metric: 'cosine' }),
        deleteIndex: vi.fn().mockResolvedValue(undefined),
      } as MastraVector;
      vi.spyOn(mastra, 'getVector').mockReturnValue(vectorMock);
      return { mastra };
    },
  },
  {
    name: 'A2A Routes',
    routes: A2A_ROUTES,
    setup: async () => {
      const { mastra, taskStore } = await setupA2ATests();
      return { mastra, taskStore };
    },
  },
  {
    name: 'Agent Builder Routes',
    routes: AGENT_BUILDER_ROUTES,
    setup: async () => {
      const setup = await setupAgentBuilderTests();
      setup.setupMocks();
      return { mastra: setup.mastra };
    },
  },
  {
    name: 'Legacy Routes',
    routes: LEGACY_ROUTES,
    setup: async () => {
      const setup = await setupLegacyTests();
      setup.setupMocks();
      return { mastra: setup.mastra };
    },
  },
];

SUITES.forEach(suite => {
  describe(`Express Adapter - ${suite.name}`, () => {
    let mastra: Mastra;
    let tools: Record<string, any> | undefined;
    let taskStore: any;
    let buildRequestOverrides: ((route: any) => RouteRequestOverrides) | undefined;

    beforeEach(async () => {
      vi.clearAllMocks();
      const setupResult = await suite.setup();
      mastra = setupResult.mastra;
      tools = setupResult.tools;
      taskStore = setupResult.taskStore;
      buildRequestOverrides = setupResult.buildRequestOverrides;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    createRouteAdapterTestSuite({
      suiteName: suite.name,
      routes: suite.routes,
        buildRequestOverrides: route => buildRequestOverrides?.(route) ?? {},
      skipRoute: suite.skipRoute,
      executeRoute: async context => {
        const executor = createExpressRouteExecutor({
          mastra,
          tools,
          taskStore,
        });
        return executor(context);
      },
    });
  });
});
