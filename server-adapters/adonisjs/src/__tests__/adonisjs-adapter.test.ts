import type { Router } from '@adonisjs/core/http';
import { createRouteAdapterTestSuite, createMultipartTestSuite } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext, AdapterSetupOptions } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouter, executeHttpRequest, listen } from './helpers';

describe('AdonisJS Server Adapter', () => {
  createRouteAdapterTestSuite({
    suiteName: 'AdonisJS Adapter Integration Tests',
    // An empty body is `undefined` for handlers whether or not it carries a JSON content type.
    emptyBodyNormalization: { withoutContentType: 'undefined', withJsonContentType: 'undefined' },
    supportsPostQueryRequestContext: true,

    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      const app = await createAdonisRouter();
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        prefix: options?.prefix,
      });
      await adapter.init();
      return { app, adapter };
    },

    executeHttpRequest,
  });

  // With the bodyparser (files autoprocessed to tmp files) and without it (adapter parses the stream)
  describe.each([true, false])('bodyparser: %s', bodyParser => {
    createMultipartTestSuite({
      suiteName: 'AdonisJS Multipart FormData',

      setupAdapter: async (context, options) => {
        const app = await createAdonisRouter({ bodyParser });
        const adapter = new MastraServer({
          app,
          mastra: context.mastra,
          taskStore: context.taskStore,
          bodyLimitOptions: options?.bodyLimitOptions,
        });
        await adapter.init();
        return { app, adapter };
      },

      startServer: async (app: Router) => {
        const server = await listen(app);
        return { baseUrl: server.url, cleanup: server.close };
      },

      registerRoute: async (adapter, app, route, options) => {
        await adapter.registerRoute(app, route, options || { prefix: '' });
      },

      getContextMiddleware: () => () => {},

      applyMiddleware: () => {},
    });
  });
});
