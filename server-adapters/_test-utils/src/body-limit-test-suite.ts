import { Mastra } from '@mastra/core/mastra';
import type { BodyLimitOptions, ServerRoute } from '@mastra/server/server-adapter';
import { describe, it, expect } from 'vitest';

/**
 * Configuration for the body-limit test suite
 */
export interface BodyLimitTestSuiteConfig<TApp> {
  /** Name for the test suite */
  suiteName?: string;

  /** Body size limit (in bytes) to configure the adapter with. Defaults to 100. */
  maxSize?: number;

  /** Create a new app instance */
  createApp: () => TApp;

  /**
   * Construct the adapter for the given app/Mastra instance with the provided
   * bodyLimitOptions, wiring up any context middleware the adapter needs.
   */
  setupAdapter: (
    app: TApp,
    mastra: Mastra,
    bodyLimitOptions: BodyLimitOptions,
  ) => { adapter: any; app: TApp } | Promise<{ adapter: any; app: TApp }>;

  /** Register the given ServerRoute on the app through the adapter's registerRoute() */
  registerRoute: (adapter: any, app: TApp, route: ServerRoute<any, any, any>) => void | Promise<void>;

  /** Execute an HTTP request against the app and return its status code */
  executeRequest: (
    app: TApp,
    method: string,
    url: string,
    options?: { headers?: Record<string, string>; body?: string },
  ) => Promise<{ status: number }>;

  /** Optional teardown for the app instance (e.g. closing a listening server) */
  cleanupApp?: (app: TApp) => void | Promise<void>;
}

/**
 * Creates a standardized body-limit test suite for server adapters.
 *
 * Exercises the adapter's registerRoute() body-limit gate (bodyLimitOptions.maxSize)
 * for both POST and DELETE. DELETE is included alongside the long-established POST
 * behavior as regression coverage: DELETE requests previously bypassed the body-limit
 * check entirely, even though the adapters' getParams() reads and JSON-parses the
 * request body for DELETE the same way it does for POST/PUT/PATCH.
 */
export function createBodyLimitTestSuite<TApp>(config: BodyLimitTestSuiteConfig<TApp>) {
  const {
    suiteName = 'Body Size Limit',
    maxSize = 100,
    createApp,
    setupAdapter,
    registerRoute,
    executeRequest,
    cleanupApp,
  } = config;

  describe(suiteName, () => {
    const oversizedPayload = JSON.stringify({ padding: 'x'.repeat(maxSize * 4) });

    it.each(['POST', 'DELETE'] as const)('rejects an oversized %s body with 413', async method => {
      const mastra = new Mastra({});
      const app = createApp();
      const { adapter, app: wiredApp } = await setupAdapter(app, mastra, {
        maxSize,
        onError: () => ({ error: 'Request body too large' }),
      });

      const testRoute: ServerRoute<any, any, any> = {
        method,
        path: '/test/body-limit',
        responseType: 'json',
        handler: async ({ body }) => ({ receivedBody: body }),
      };

      await registerRoute(adapter, wiredApp, testRoute);

      const response = await executeRequest(wiredApp, method, 'http://localhost/test/body-limit', {
        headers: { 'Content-Type': 'application/json' },
        body: oversizedPayload,
      });

      expect(response.status).toBe(413);

      await cleanupApp?.(wiredApp);
    });
  });
}
