import type { Router } from '@adonisjs/core/http';
import { createBodyLimitTestSuite } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouterFor, getApplication, listen, rawRequest } from './helpers';

const application = await getApplication();

async function send(
  router: Router,
  method: string,
  url: string,
  options: { headers?: Record<string, string>; body?: string },
  chunked: boolean,
) {
  const { url: baseUrl, close } = await listen(router);
  try {
    const { pathname, search } = new URL(url);
    const response = await rawRequest(`${baseUrl}${pathname}${search}`, method, { ...options, chunked });
    return { status: response.status };
  } finally {
    await close();
  }
}

describe('AdonisJS Server Adapter', () => {
  // Default AdonisJS app: the bodyparser router middleware reads the body first.
  // Chunked cases are not run here: AdonisJS v6 bodyparser rejects any chunked JSON/text body
  // with 400 "request size did not match content length" before a route handler runs.
  createBodyLimitTestSuite<Router>({
    suiteName: 'AdonisJS Body Size Limit (bodyparser)',
    createApp: () => createAdonisRouterFor(application),
    setupAdapter: (app, mastra, bodyLimitOptions) => ({
      adapter: new MastraServer({ app, mastra, bodyLimitOptions }),
      app,
    }),
    registerRoute: (adapter, app, route) => adapter.registerRoute(app, route, { prefix: '' }),
    executeRequest: (app, method, url, options = {}) => send(app, method, url, options, false),
  });

  // Without the bodyparser the adapter reads the raw stream and enforces the limit itself.
  createBodyLimitTestSuite<Router>({
    suiteName: 'AdonisJS Body Size Limit (no bodyparser)',
    createApp: () => createAdonisRouterFor(application, { bodyParser: false }),
    setupAdapter: (app, mastra, bodyLimitOptions) => ({
      adapter: new MastraServer({ app, mastra, bodyLimitOptions }),
      app,
    }),
    registerRoute: (adapter, app, route) => adapter.registerRoute(app, route, { prefix: '' }),
    executeRequest: (app, method, url, options = {}) => send(app, method, url, options, false),
    executeRequestWithoutContentLength: (app, method, url, options = {}) => send(app, method, url, options, true),
  });
});
