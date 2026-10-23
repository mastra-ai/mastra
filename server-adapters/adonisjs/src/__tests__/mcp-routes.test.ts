import type { Router } from '@adonisjs/core/http';
import { createMCPRouteTestSuite } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouter, executeHttpRequest } from './helpers';

describe('AdonisJS MCP Registry Routes Integration', () => {
  createMCPRouteTestSuite({
    suiteName: 'AdonisJS Adapter',
    setupAdapter: async (context: AdapterTestContext) => {
      const app = await createAdonisRouter();
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
      });
      await adapter.init();
      return { app, adapter };
    },
    executeHttpRequest: (app: Router, request) => executeHttpRequest(app, request),
  });
});
