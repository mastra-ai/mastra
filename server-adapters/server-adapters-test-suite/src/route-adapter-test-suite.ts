import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { registerApiRoute } from '@mastra/core/server';
import { handleError } from '@mastra/server/handlers/error';
import { createRoute, HTTPException, SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { z as z3 } from 'zod/v3';

import { createRouteTestSuite } from './route-test-suite';
import { expectValidSchema } from './route-test-utils';
import { buildRouteRequest, createDefaultTestContext, parseDatesInResponse } from './test-helpers';
import type { AdapterTestContext, AdapterTestSuiteConfig, HttpRequest } from './test-helpers';

/**
 * Creates a standardized integration test suite for server adapters (Express/Hono)
 *
 * Tests the complete HTTP request/response cycle:
 * - Parameter extraction from URL/query/body
 * - Schema validation
 * - Handler execution
 * - Response formatting
 *
 * Uses auto-generated test data from route schemas.
 * For specific test scenarios, write additional tests outside the factory.
 */
export function createRouteAdapterTestSuite(config: AdapterTestSuiteConfig) {
  const { suiteName = 'Route Adapter Integration', setupAdapter, executeHttpRequest, createTestContext } = config;

  describe('Route Validation', () => {
    createRouteTestSuite({
      routes: SERVER_ROUTES,
    });
  });

  describe(suiteName, () => {
    let context: AdapterTestContext;
    let app: any;
    let setup: Awaited<ReturnType<typeof setupAdapter>>;

    beforeEach(async () => {
      // Create test context - use provided or default
      if (createTestContext) {
        const result = createTestContext();
        context = result instanceof Promise ? await result : result;
      } else {
        context = await createDefaultTestContext();
      }

      // Setup adapter and app
      setup = await setupAdapter(context);
      app = setup.app;
    });

    if (config.supportsPostQueryRequestContext) {
      it('merges query requestContext into POST route handlers', async () => {
        await setup.adapter.registerRoute(app, {
          method: 'POST',
          path: '/test/query-request-context',
          responseType: 'json',
          bodySchema: z.object({ data: z.string() }),
          handler: async ({ requestContext }: { requestContext?: { get: (key: string) => unknown } }) => ({
            userId: requestContext?.get('userId'),
          }),
        });

        const response = await executeHttpRequest(app, {
          method: 'POST',
          path: '/api/test/query-request-context',
          query: { requestContext: JSON.stringify({ userId: 'query-user-123' }) },
          body: { data: 'test' },
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ userId: 'query-user-123' });
      });
    }

    it('ignores special object keys in query params while preserving legitimate params', async () => {
      await setup.adapter.registerRoute(app, {
        method: 'GET',
        path: '/test/query-special-keys',
        responseType: 'json',
        handler: async (params: any) => ({
          filter: typeof params.filter === 'string' ? JSON.parse(params.filter) : null,
          tag: params.tag ?? null,
          keys: Object.keys(params).filter(
            k =>
              ![
                'mastra',
                'requestContext',
                'tools',
                'taskStore',
                'abortSignal',
                'registeredTools',
                'routePrefix',
                'request',
              ].includes(k),
          ),
        }),
      });

      const response = await executeHttpRequest(app, {
        method: 'GET',
        path: '/api/test/query-special-keys',
        query: Object.fromEntries([
          // Keys that must never be written onto parsed objects
          ['__proto__[polluted]', 'yes'],
          ['constructor[prototype]', 'yes'],
          ['prototype[x]', 'yes'],
          ['filter[__proto__]', 'yes'],
          // Legitimate params alongside them
          ['filter[status]', 'active'],
          ['tag', ['a', 'b']],
          ['page', '2'],
        ]),
      });

      expect(response.status).toBe(200);
      const data = response.data as any;
      // Bracket-notation groups still reconstruct as before
      expect(data.filter).toEqual({ status: 'active' });
      // Repeated keys still arrive (as an array where the framework preserves
      // them; some frameworks collapse them to the last value — both are the
      // pre-existing behavior and must not change)
      const tags = Array.isArray(data.tag) ? data.tag : [data.tag];
      expect(tags).toContain('b');
      // Special keys are dropped, not parsed
      expect(data.keys).not.toContain('__proto__');
      expect(data.keys).not.toContain('constructor');
      expect(data.keys).not.toContain('prototype');
      // The process-wide Object.prototype must be untouched
      expect(({} as any).polluted).toBeUndefined();
    });

    describe.each([
      {
        version: 'v3',
        recordSchema: z3.record(z3.string(), z3.string()),
        objectSchema: z3.object({ limit: z3.number().default(10) }),
      },
      {
        version: 'v4',
        recordSchema: z.record(z.string(), z.string()),
        objectSchema: z.object({ limit: z.number().default(10) }),
      },
    ])('Zod $version record body validation', ({ recordSchema, objectSchema }) => {
      beforeEach(async () => {
        await setup.adapter.registerRoute(app, {
          method: 'DELETE',
          path: '/test/record-body',
          responseType: 'json',
          bodySchema: recordSchema,
          handler: async () => ({ success: true }),
        });
        await setup.adapter.registerRoute(app, {
          method: 'DELETE',
          path: '/test/object-body',
          responseType: 'json',
          bodySchema: objectSchema,
          handler: async ({ limit }: { limit: number }) => ({ limit }),
        });
      });

      it('does not convert missing record bodies to empty objects', async () => {
        const response = await executeHttpRequest(app, { method: 'DELETE', path: '/api/test/record-body' });
        // Some framework parsers already supply {} before adapter validation runs.
        const alreadyNormalized = config.emptyBodyNormalization?.withoutContentType === 'empty-object';
        expect(response.status).toBe(alreadyNormalized ? 200 : 400);
        if (!alreadyNormalized) {
          expect(response.data).toMatchObject({ error: 'Invalid request body', issues: [{ field: 'root' }] });
        }
      });

      it('accepts explicitly empty record bodies', async () => {
        const response = await executeHttpRequest(app, { method: 'DELETE', path: '/api/test/record-body', body: {} });
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ success: true });
      });

      it('keeps bodyless object field defaults', async () => {
        const response = await executeHttpRequest(app, { method: 'DELETE', path: '/api/test/object-body' });
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ limit: 10 });
      });
    });

    describe('Whole-body defaults over HTTP', () => {
      const normalization = config.emptyBodyNormalization ?? {
        withoutContentType: 'undefined',
        withJsonContentType: 'undefined',
      };

      beforeEach(async () => {
        await setup.adapter.registerRoute(
          app,
          createRoute({
            method: 'POST',
            path: '/test/root-default',
            responseType: 'json',
            bodySchema: z.object({ marker: z.string().optional() }).default({ marker: 'root-default' }),
            handler: async ({ marker }) => ({ marker }),
          }),
        );
      });

      it.each([
        {
          label: 'omitted body without Content-Type',
          body: undefined,
          headers: undefined,
          normalized: normalization.withoutContentType,
        },
        {
          label: 'zero-byte JSON body',
          body: undefined,
          headers: { 'Content-Type': 'application/json' },
          normalized: normalization.withJsonContentType,
        },
        {
          label: 'explicit empty JSON object',
          body: {},
          headers: { 'Content-Type': 'application/json' },
          normalized: 'empty-object',
        },
      ])('$label respects framework normalization', async ({ body, headers, normalized }) => {
        const response = await executeHttpRequest(app, {
          method: 'POST',
          path: '/api/test/root-default',
          body,
          headers,
        });
        if (normalized === 'empty-string') {
          expect(response.status).toBe(400);
          expect(response.data).toEqual({
            error: 'Invalid request body',
            issues: [{ field: 'root', message: expect.stringContaining('string') }],
          });
        } else {
          expect(response.status).toBe(200);
          expect(response.data).toEqual(normalized === 'undefined' ? { marker: 'root-default' } : {});
        }
      });
    });

    describe('Scalar JSON body validation', () => {
      beforeEach(async () => {
        const route = createRoute({
          method: 'DELETE',
          path: '/test/scalar-body',
          responseType: 'json',
          bodySchema: z
            .union([z.null(), z.literal(false), z.literal(0), z.literal('')])
            .transform(value => ({ value })),
          handler: async ({ value }) => ({ value }),
          onValidationError: () => ({ status: 400, body: { error: 'Scalar schema rejected body' } }),
        });
        await setup.adapter.registerRoute(app, route);
      });
      it.each([null, false, 0, ''])('validates scalar JSON through the route schema: %j', async body => {
        const accepted = await executeHttpRequest(app, {
          method: 'DELETE',
          path: '/api/test/scalar-body',
          body,
        });
        expect(accepted.status).toBe(200);
        expect(accepted.data).toEqual({ value: body });
      });
      it('returns the route validation response for an invalid scalar', async () => {
        const rejected = await executeHttpRequest(app, {
          method: 'DELETE',
          path: '/api/test/scalar-body',
          body: true,
        });
        expect(rejected.status).toBe(400);
        expect(rejected.data).toEqual({ error: 'Scalar schema rejected body' });
      });
    });

    describe.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('%s required body validation', method => {
      beforeEach(async () => {
        await setup.adapter.registerRoute(
          app,
          createRoute({
            method,
            path: '/test/required-body',
            responseType: 'json',
            bodySchema: z.object({ itemIds: z.array(z.string().min(1)).min(1) }),
            handler: async ({ itemIds }) => ({ itemIds }),
            onValidationError: () => ({ status: 400, body: { error: 'Required schema rejected body' } }),
          }),
        );
        await setup.adapter.registerRoute(
          app,
          createRoute({
            method,
            path: '/test/optional-body',
            responseType: 'json',
            bodySchema: z.object({ name: z.string().optional(), limit: z.number().default(10) }),
            handler: async ({ limit }) => ({ limit }),
          }),
        );
      });

      it.each([undefined, null, false, 0, '', {}, { itemIds: [] }, { itemIds: [''] }])(
        'rejects missing or invalid required input %#',
        async body => {
          const response = await executeHttpRequest(app, {
            method,
            path: '/api/test/required-body',
            body,
          });
          expect(response.status).toBe(400);
          expect(response.data).toEqual({ error: 'Required schema rejected body' });
        },
      );

      it('passes valid required input to the handler', async () => {
        const body = { itemIds: ['item-1'] };
        const response = await executeHttpRequest(app, {
          method,
          path: '/api/test/required-body',
          body,
        });
        expect(response.status).toBe(200);
        expect(response.data).toEqual(body);
      });

      it('applies field defaults when the body is omitted', async () => {
        const response = await executeHttpRequest(app, {
          method,
          path: '/api/test/optional-body',
        });
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ limit: 10 });
      });
    });

    it.each([
      { body: {}, field: 'itemIds' },
      { body: { itemIds: [''] }, field: 'itemIds.0' },
    ])('returns standard validation issues for $field', async ({ body, field }) => {
      await setup.adapter.registerRoute(
        app,
        createRoute({
          method: 'DELETE',
          path: '/test/default-validation-error',
          responseType: 'json',
          bodySchema: z.object({ itemIds: z.array(z.string().min(1)).min(1) }),
          handler: async ({ itemIds }) => ({ itemIds }),
        }),
      );
      const response = await executeHttpRequest(app, {
        method: 'DELETE',
        path: '/api/test/default-validation-error',
        body,
      });
      expect(response.status).toBe(400);
      expect(response.data).toEqual({
        error: 'Invalid request body',
        issues: [{ field, message: expect.any(String) }],
      });
    });

    it('preserves bodyless create-run requests with optional fields', async () => {
      const response = await executeHttpRequest(app, {
        method: 'POST',
        path: '/api/workflows/test-workflow/create-run',
      });
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({ runId: expect.any(String) });
    });

    // Test deprecated routes separately - just verify they're marked correctly
    const deprecatedRoutes = SERVER_ROUTES.filter(r => r.deprecated);

    // Group deprecated routes by first path segment
    const deprecatedByCategory = deprecatedRoutes.reduce<Record<string, typeof deprecatedRoutes>>((acc, route) => {
      const category = route.path.split('/')[1] || 'root';
      if (!acc[category]) acc[category] = [];
      acc[category].push(route);
      return acc;
    }, {});

    Object.entries(deprecatedByCategory).forEach(([category, routes]) => {
      describe(category, () => {
        routes.forEach(route => {
          const testName = `${route.method} ${route.path}`;
          describe(testName, () => {
            it('should be marked as deprecated', () => {
              expect(route.deprecated).toBe(true);
              expect(route.openapi?.deprecated).toBe(true);
            });
          });
        });
      });
    });

    // Test non-deprecated routes with full test suite
    // Skip MCP transport routes (mcp-http, mcp-sse) - they require MCP protocol handling
    // and are tested separately via mcp-transport-test-suite
    // Skip auth routes that require specific providers (SSO, credentials) - they return 404
    // when providers aren't configured, which is expected behavior
    // Note: Route paths in SERVER_ROUTES don't include /api prefix
    const authRoutesRequiringProviders = [
      '/auth/sso/login',
      '/auth/sso/callback',
      '/auth/credentials/sign-in',
      '/auth/credentials/sign-up',
      '/auth/refresh',
      // Requires a provider that can actually end a session (destroySession,
      // getClearSessionHeaders, or getLogoutUrl). Without one there is nothing to log out
      // of, so it 404s like /auth/refresh. Per-status behavior is covered in
      // packages/server/src/server/handlers/auth.test.ts.
      '/auth/logout',
      // Requires an authenticated admin caller (MASTRA_USER_PERMISSIONS_KEY is a reserved
      // request-context key set only by the auth middleware) and an RBAC provider with
      // getPermissionsForRole. Per-status behavior is covered in
      // packages/server/src/server/handlers/auth.test.ts.
      '/auth/roles/:roleId/permissions',
    ];
    // Skip routes that require external dependencies (APIs)
    const routesRequiringExternalDeps = [
      // skills-sh routes that require external API calls (GitHub, skills.sh)
      '/workspaces/:workspaceId/skills-sh/search',
      '/workspaces/:workspaceId/skills-sh/popular',
      '/workspaces/:workspaceId/skills-sh/preview',
      '/workspaces/:workspaceId/skills-sh/install',
      '/workspaces/:workspaceId/skills-sh/remove',
      '/workspaces/:workspaceId/skills-sh/update',
      // observational memory routes require OM-enabled agent configuration
      '/memory/observational-memory',
      '/memory/observational-memory/buffer-status',
      // skill publish requires blob storage not available in InMemoryStore
      '/stored/skills/:storedSkillId/publish',
      // POST /stored/agents requires a builder-resolved model policy and a
      // model-allowlist-compatible payload; the generic test suite produces a
      // payload that fails allowlist enforcement. Behavior is covered by
      // packages/server/src/server/handlers/stored-agents.test.ts.
      '/stored/agents',
      // Favorites toggles require an existing stored entity AND an
      // authenticated caller (callerId is read from the auth-middleware
      // request context). Behavior is covered by stored-{agent,skill}-favorites
      // unit tests; the generic test suite can't satisfy both prereqs.
      '/stored/agents/:storedAgentId/favorite',
      '/stored/skills/:storedSkillId/favorite',
      // Change request creation requires a source-control provider that can open
      // PRs; the generic test sutie has no provider. Covered by stored-agents tests.
      '/stored/agents/:storedAgentId/change-request',
      // Builder registry routes that require external API calls + builder config
      '/editor/builder/registries',
      '/editor/builder/registries/:registryId/search',
      '/editor/builder/registries/:registryId/popular',
      '/editor/builder/registries/:registryId/preview',
      '/editor/builder/registries/:registryId/install',
      // Long-lived SSE streams: stay open until the client disconnects, so the
      // test test suite's real-HTTP-server cleanup (server.close awaiting drain)
      // hangs. These routes' behavior is exercised in unit tests.
      '/background-tasks/stream',
      '/agents/:agentId/observe',
      // Covered by packages/server/src/server/handlers/mcp-events.test.ts.
      '/mcp/:serverId/events/:eventName/stream',
      // Recover requires both a durable agent and a persisted workflow run.
      // Its stateful behavior is covered by packages/server/src/server/handlers/agents.test.ts.
      '/agents/:agentId/recover',
      // Reading a submitted plan requires an agent exposing the core submit_plan tool
      // and a workspace filesystem containing the plan. The generic agent has neither;
      // capability, path, and filesystem behavior are covered by plans.test.ts.
      '/agents/:agentId/plans/file',
      // Tool-provider connection routes that require a persisted connection
      // row matching the supplied connectionId. The test suite uses a generic
      // 'test-connection-id' that isn't seeded, so the fail-closed ownership
      // guard returns 403. Behavior is covered by
      // packages/server/src/server/handlers/tool-providers.test.ts.
      '/tool-providers/:providerId/connections/:connectionId',
      '/tool-providers/:providerId/connections/:connectionId/usage',
      // Tool-provider authorize + connection-status routes require a real
      // OAuth provider config; the generic test suite produces a payload the
      // mock provider can't authorize. Covered by tool-providers.test.ts.
      '/tool-providers/:providerId/authorize',
      '/tool-providers/:providerId/connection-status',
      // Tool-provider auth-status requires a live provider auth lookup that
      // the mock provider doesn't implement. Covered by tool-providers.test.ts.
      '/tool-providers/:providerId/auth-status/:authId',
      // Tool-provider connections list relies on storage rows being seeded
      // for the test author. Covered by tool-providers.test.ts.
      '/tool-providers/:providerId/connections',
      // Experiment deletion requires a persisted experiment matching the generated
      // experimentId. The generic test context does not seed dataset storage;
      // deletion behavior is covered by datasets.test.ts.
      '/experiments/:experimentId',
    ];
    // Routes under these prefixes are excluded (e.g. /datasets needs a datasets storage domain)
    const excludedPrefixes = [
      '/datasets',
      // Agent-controller routes resolve a registered AgentController via
      // mastra.getAgentController(id) and operate on a live session keyed by
      // resourceId. The generic test context registers no controller, so every
      // route fails closed with 404. Behavior is covered by
      // packages/server/src/server/handlers/agent-controller.test.ts.
      '/agent-controller',
    ];
    const isExcluded = (r: ServerRoute) =>
      r.deprecated ||
      r.responseType === 'mcp-http' ||
      r.responseType === 'mcp-sse' ||
      authRoutesRequiringProviders.includes(r.path) ||
      routesRequiringExternalDeps.includes(r.path) ||
      excludedPrefixes.some(prefix => r.path.startsWith(prefix));
    const activeRoutes = SERVER_ROUTES.filter(r => !isExcluded(r));

    // Routes that are only served under `mastra dev` and return 404 otherwise.
    // MASTRA_DEV is scoped to these routes because it also relaxes auth elsewhere.
    const devOnlyRoutes = ['/mcp/:serverId/events/:eventName/emit'];

    // Group routes by first path segment (e.g., /agents/:id/tools -> 'agents')
    const routesByCategory = activeRoutes.reduce<Record<string, typeof activeRoutes>>((acc, route) => {
      const category = route.path.split('/')[1] || 'root';
      if (!acc[category]) acc[category] = [];
      acc[category].push(route);
      return acc;
    }, {});

    Object.entries(routesByCategory).forEach(([category, routes]) => {
      describe(category, () => {
        routes.forEach(route => {
          const testName = `${route.method} ${route.path}`;
          describe(testName, () => {
            if (devOnlyRoutes.includes(route.path)) {
              beforeEach(() => {
                vi.stubEnv('MASTRA_DEV', 'true');
              });
              afterEach(() => {
                vi.unstubAllEnvs();
              });
            }

            it('should execute with valid request', async () => {
              // Build HTTP request with auto-generated test data
              const request = buildRouteRequest(route);

              // Convert to HttpRequest format
              const httpRequest: HttpRequest = {
                method: request.method,
                path: request.path,
                query: request.query,
                body: request.body,
              };

              // Execute through adapter
              const response = await executeHttpRequest(app, httpRequest);

              // Validate response
              expect(response.status).toBeLessThan(400);

              if (route.responseType === 'json') {
                expect(response.type).toBe('json');
                expect(response.data).toBeDefined();

                // Validate response schema (if defined)
                if (route.responseSchema) {
                  const parsedData = parseDatesInResponse(response.data, route.responseSchema);
                  expectValidSchema(route.responseSchema, parsedData);
                }

                // Verify JSON is serializable (no circular refs, functions, etc)
                expect(() => JSON.stringify(response.data)).not.toThrow();
              } else if (route.responseType === 'stream') {
                expect(response.type).toBe('stream');
                expect(response.stream).toBeDefined();

                // Verify stream is consumable (has getReader or is async iterable)
                const hasReader = response.stream && typeof (response.stream as any).getReader === 'function';
                const isAsyncIterable =
                  response.stream &&
                  typeof (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function';
                expect(hasReader || isAsyncIterable).toBe(true);
              }
            });

            // Error handling tests for routes with entity IDs
            if (route.path.includes(':agentId')) {
              it('should return 404 when agent not found', async () => {
                // Build request with non-existent agent
                const request = buildRouteRequest(route, {
                  pathParams: { agentId: 'non-existent-agent' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                // Expect 404 status
                expect(response.status).toBe(404);
              });
            }

            if (route.path.includes(':workflowId')) {
              it('should return 404 when workflow not found', async () => {
                const request = buildRouteRequest(route, {
                  pathParams: { workflowId: 'non-existent-workflow' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBe(404);
              });
            }

            if (route.path.includes(':backgroundTaskId')) {
              it('should return 404 when background task not found', async () => {
                const request = buildRouteRequest(route, {
                  pathParams: { backgroundTaskId: 'non-existent-background-task' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBe(404);
              });
            }

            // MCP server 404 tests
            if (route.path.includes(':serverId')) {
              it('should return 404 when MCP server not found (via :serverId)', async () => {
                const request = buildRouteRequest(route, {
                  pathParams: { serverId: 'non-existent-server' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBe(404);
              });
            }

            // MCP v0 server detail 404 test (uses :id instead of :serverId)
            if (route.path.includes('/mcp/v0/servers/:id')) {
              it('should return 404 when MCP server not found (via :id)', async () => {
                const request = buildRouteRequest(route, {
                  pathParams: { id: 'non-existent-server' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBe(404);
              });
            }

            // Processor 404 tests
            if (route.path.includes(':processorId')) {
              it('should return 404 when processor not found', async () => {
                const request = buildRouteRequest(route, {
                  pathParams: { processorId: 'non-existent-processor' },
                });

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBe(404);
              });
            }

            // Stream consumption test
            if (route.responseType === 'stream') {
              it('should be consumable via stream reader', async () => {
                const request = buildRouteRequest(route);

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: request.body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                expect(response.status).toBeLessThan(400);
                expect(response.stream).toBeDefined();

                // Try to consume the stream
                if (typeof (response.stream as any).getReader === 'function') {
                  // Web Streams API
                  const reader = (response.stream as ReadableStream).getReader();
                  const firstChunk = await reader.read();
                  expect(firstChunk).toBeDefined();
                  // Don't validate chunk structure - that's handler's job
                  reader.releaseLock();
                } else if (typeof (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
                  // Async iterable
                  const iterator = (response.stream as AsyncIterable<unknown>)[Symbol.asyncIterator]();
                  const firstChunk = await iterator.next();
                  expect(firstChunk).toBeDefined();
                }
              });
            }

            // Schema validation tests - only for routes with query or body schemas
            if (route.queryParamSchema || route.bodySchema) {
              it('should return 400 when schema validation fails', async () => {
                const request = buildRouteRequest(route);

                let httpRequest: HttpRequest;

                if (route.queryParamSchema) {
                  // Add invalid query param (add an object where string/number expected)
                  httpRequest = {
                    method: request.method,
                    path: request.path,
                    query: {
                      ...(request.query || {}),
                      invalidQueryParam: { nested: 'object' } as any,
                    },
                    body: request.body,
                  };
                } else if (route.bodySchema) {
                  // Keep valid request but add an invalid field with wrong type
                  httpRequest = {
                    method: request.method,
                    path: request.path,
                    query: request.query,
                    body: {
                      ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                      invalidBodyField: { deeply: { nested: 'object' } },
                    },
                  };
                } else {
                  // Shouldn't happen, but fallback
                  httpRequest = {
                    method: request.method,
                    path: request.path,
                    query: request.query,
                    body: request.body,
                  };
                }

                const response = await executeHttpRequest(app, httpRequest);

                // Routes may use the shared 400 response or a route-specific 422 response.
                // Lenient schemas may still succeed if they ignore unknown fields.
                expect([200, 201, 400, 422]).toContain(response.status);

                if (response.status === 400 || response.status === 422) {
                  expect(response.type).toBe('json');

                  // Verify error response has helpful structure
                  const errorData = response.data as any;
                  expect(errorData).toBeDefined();
                  expect(errorData.error || errorData.message || errorData.details).toBeDefined();
                }
              });
            }

            // RequestContext tests - test for POST/PUT routes that accept body
            if (['POST', 'PUT'].includes(route.method) && route.bodySchema) {
              it('should accept requestContext in body', async () => {
                const request = buildRouteRequest(route);

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body: {
                    ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                    requestContext: { userId: 'test-user-123', sessionId: 'session-456' },
                  },
                };

                const response = await executeHttpRequest(app, httpRequest);

                // Should succeed - requestContext is optional and should not cause errors
                expect(response.status).toBeLessThan(500);
              });
            }

            // Body field spreading test - for POST/PUT routes with body
            const bodySchema = route.bodySchema;
            if (['POST', 'PUT'].includes(route.method) && bodySchema) {
              it('should spread body fields to handler params', async () => {
                const request = buildRouteRequest(route);

                // Add a unique field to the body
                const testField = 'testBodyField';
                const testValue = 'testValue123';

                const body = {
                  ...(typeof request.body === 'object' && request.body !== null ? request.body : {}),
                  [testField]: testValue,
                };
                const strictBody = !bodySchema.safeParse(body).success;

                const httpRequest: HttpRequest = {
                  method: request.method,
                  path: request.path,
                  query: request.query,
                  body,
                };

                const response = await executeHttpRequest(app, httpRequest);

                if (strictBody) {
                  // Strict schemas must surface either the shared or route-specific validation rejection.
                  expect([400, 422]).toContain(response.status);
                } else {
                  // lenient schema: unknown field must be ignored, request must succeed
                  expect(response.status).toBeLessThan(400);
                }
              });
            }
          });
        });
      });
    });

    // Additional cross-route tests
    describe('Cross-Route Tests', () => {
      // Test array query parameters for ALL GET routes
      const getRoutes = SERVER_ROUTES.filter(r => r.method === 'GET' && !isExcluded(r));
      getRoutes.forEach(route => {
        it(`should handle array query parameters for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route);

          const httpRequest: HttpRequest = {
            method: request.method,
            path: request.path,
            query: {
              ...(request.query || {}),
              tags: ['tag1', 'tag2', 'tag3'],
            },
          };

          const response = await executeHttpRequest(app, httpRequest);

          // Should handle array params without error
          if (response.status >= 500) {
            console.error(`[FAIL] ${route.method} ${route.path} returned ${response.status}`, response.data);
          }
          expect(response.status).toBeLessThan(500);
        });
      });

      // Test error response structure for ALL routes with agentId
      const agentRoutes = SERVER_ROUTES.filter(r => r.path.includes(':agentId') && !r.deprecated);
      agentRoutes.forEach(route => {
        it(`should return valid error response structure for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route, {
            pathParams: { agentId: 'non-existent-agent-error-test' },
          });

          const httpRequest: HttpRequest = {
            method: request.method,
            path: request.path,
            query: request.query,
            body: request.body,
          };

          const response = await executeHttpRequest(app, httpRequest);

          expect(response.status).toBe(404);
          expect(response.type).toBe('json');

          // Verify error has a structured format
          const errorData = response.data as any;
          expect(errorData).toBeDefined();

          // Should have at least one of these error fields
          const hasErrorField =
            errorData.error !== undefined ||
            errorData.message !== undefined ||
            errorData.details !== undefined ||
            errorData.statusCode !== undefined;

          expect(hasErrorField).toBe(true);
        });
      });

      // Test empty body for ALL POST routes with body schema
      const postRoutesWithBody = SERVER_ROUTES.filter(r => r.method === 'POST' && r.bodySchema && !isExcluded(r));
      postRoutesWithBody.forEach(route => {
        it(`should handle empty body for ${route.method} ${route.path}`, async () => {
          const request = buildRouteRequest(route);

          const httpRequest: HttpRequest = {
            method: request.method,
            path: request.path,
            query: request.query,
            body: {}, // Empty body - missing required fields
          };

          const response = await executeHttpRequest(app, httpRequest);

          // Should return the shared or route-specific validation response for missing fields
          // (or 200/201 if all fields are optional).
          expect([200, 201, 400, 422]).toContain(response.status);

          if (response.status === 400 || response.status === 422) {
            expect(response.type).toBe('json');
            const errorData = response.data as any;
            expect(errorData).toBeDefined();
            // Verify error response has helpful structure when validation is explicit
            if (!(errorData.error || errorData.message || errorData.details)) {
              console.warn(`[WARN] ${route.method} ${route.path} 400 response missing error fields`, errorData);
            }
          }
        });
      });
    });

    describe.skipIf(config.supportsRBAC === false)('Studio-only RBAC', () => {
      // RBAC lives only under `studio`; `server.rbac` is unset. Studio requests must
      // still be checked against `studio.rbac` on both built-in and custom API routes.
      const rolePermissions: Record<string, string[]> = {
        viewer: ['agents:read'],
        member: ['agents:read', 'tools:execute'],
      };
      const studioAuth = {
        authenticateToken: async (token: string) =>
          rolePermissions[token] ? { id: `user_${token}`, role: token } : null,
        authorize: async () => true,
      };
      const studioRbac = {
        getPermissions: async (user: { role: string }) => rolePermissions[user.role] ?? [],
        getRoles: async (user: { role: string }) => [user.role],
      };

      async function setupStudioRbac(options: { withServerAuth: boolean }) {
        const ctx = await createDefaultTestContext();
        const originalGetServer = ctx.mastra.getServer.bind(ctx.mastra);
        const customRoute = registerApiRoute('/studio-rbac/custom', {
          method: 'GET',
          requiresPermission: 'tools:execute',
          handler: async c => c.json({ ok: true }),
        });
        ctx.mastra.getServer = () =>
          ({
            ...originalGetServer(),
            apiRoutes: [customRoute],
            ...(options.withServerAuth ? { auth: studioAuth } : {}),
          }) as any;
        (ctx.mastra as any).getStudio = () => ({ auth: studioAuth, rbac: studioRbac });
        ctx.customRouteAuthConfig = new Map([['GET:/studio-rbac/custom', true]]);

        const route: ServerRoute = {
          method: 'GET',
          path: '/test/studio-rbac',
          responseType: 'json',
          requiresPermission: 'tools:execute',
          handler: async () => ({ ok: true }),
        };
        const mutableServerRoutes = SERVER_ROUTES as ServerRoute[];
        const originalLength = mutableServerRoutes.length;
        mutableServerRoutes.push(route);
        try {
          return (await setupAdapter(ctx)).app;
        } finally {
          mutableServerRoutes.splice(originalLength);
        }
      }

      const studioRequest = (path: string, role: string): HttpRequest => ({
        method: 'GET',
        path,
        headers: { Authorization: `Bearer ${role}`, 'x-mastra-client-type': 'studio' },
      });

      describe.each([
        { label: 'studio auth only', withServerAuth: false },
        { label: 'studio auth + server auth without server RBAC', withServerAuth: true },
      ])('$label', ({ withServerAuth }) => {
        it.each(['/api/test/studio-rbac', '/studio-rbac/custom'])(
          'denies a studio user without the required permission on %s',
          async path => {
            const studioApp = await setupStudioRbac({ withServerAuth });
            const response = await executeHttpRequest(studioApp, studioRequest(path, 'viewer'));
            expect(response.status).toBe(403);
          },
        );

        it.each(['/api/test/studio-rbac', '/studio-rbac/custom'])(
          'allows a studio user with the required permission on %s',
          async path => {
            const studioApp = await setupStudioRbac({ withServerAuth });
            const response = await executeHttpRequest(studioApp, studioRequest(path, 'member'));
            expect(response.status).toBe(200);
          },
        );
      });
    });

    describe('Custom HTTPException responses', () => {
      async function setupCustomErrorRoutes() {
        let handlerCalls = 0;
        const routes: ServerRoute<any, any, any>[] = [
          {
            method: 'GET',
            path: '/custom/http-error-json',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw new HTTPException(409, {
                res: Response.json(
                  { code: 'TRACE_QUERY_CURSOR_CONFLICT', message: 'The cursor does not match the query' },
                  { headers: { 'X-Trace-Error': 'cursor' } },
                ),
              });
            },
          },
          {
            method: 'GET',
            path: '/custom/http-error-text',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw new HTTPException(418, {
                res: new Response('custom text', {
                  headers: { 'Content-Type': 'text/custom', 'X-Custom-Error': 'true' },
                }),
              });
            },
          },
          {
            method: 'GET',
            path: '/custom/http-error-fallback',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw new HTTPException(404, { message: 'Legacy fallback' });
            },
          },
          {
            method: 'GET',
            path: '/custom/http-error-failing-items',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw new HTTPException(400, {
                message: 'Existing items fail the new schema',
                cause: { failingItems: [{ index: 0, data: {}, field: 'input' }] },
              });
            },
          },
          {
            method: 'GET',
            path: '/custom/http-error-unsafe-cause',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw new HTTPException(400, {
                message: 'Unsafe cause',
                cause: { secret: 'do-not-leak', failingItems: 'not-an-array' },
              });
            },
          },
          {
            method: 'GET',
            path: '/custom/details-status-error',
            responseType: 'json',
            handler: async () => {
              handlerCalls++;
              throw Object.assign(new Error('Details status'), {
                details: { status: 422 },
                cause: { failingItems: [{ index: 0 }] },
              });
            },
          },
        ];
        const mutableServerRoutes = SERVER_ROUTES as ServerRoute[];
        const originalLength = mutableServerRoutes.length;
        mutableServerRoutes.push(...routes);
        try {
          const setup = await setupAdapter(await createDefaultTestContext());
          return { app: setup.app, getHandlerCalls: () => handlerCalls };
        } finally {
          mutableServerRoutes.splice(originalLength);
        }
      }

      it('preserves an attached JSON response and headers', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/http-error-json',
        });

        expect(response.status).toBe(409);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['x-trace-error']).toBe('cursor');
        expect(response.data).toEqual({
          code: 'TRACE_QUERY_CURSOR_CONFLICT',
          message: 'The cursor does not match the query',
        });
        expect(custom.getHandlerCalls()).toBe(1);
      });

      it('preserves an attached text response without JSON wrapping', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/http-error-text',
        });

        expect(response.status).toBe(418);
        expect(response.headers['content-type']).toContain('text/custom');
        expect(response.headers['x-custom-error']).toBe('true');
        expect(response.data).toBe('custom text');
        expect(custom.getHandlerCalls()).toBe(1);
      });

      it('retains the JSON fallback for message-only HTTP exceptions', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/http-error-fallback',
        });

        expect(response.status).toBe(404);
        expect(response.data).toEqual({ error: 'Legacy fallback' });
        expect(custom.getHandlerCalls()).toBe(1);
      });

      it('includes failingItems from the HTTPException cause in the JSON body', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/http-error-failing-items',
        });

        expect(response.status).toBe(400);
        expect((response.data as any).error).toBe('Existing items fail the new schema');
        expect((response.data as any).cause).toEqual({ failingItems: [{ index: 0, data: {}, field: 'input' }] });
      });

      it('never forwards an arbitrary HTTPException cause', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/http-error-unsafe-cause',
        });

        expect(response.status).toBe(400);
        expect((response.data as any).error).toBe('Unsafe cause');
        expect(response.data).not.toHaveProperty('cause');
        expect(JSON.stringify(response.data)).not.toContain('do-not-leak');
      });

      it('keeps details.status errors as a message-only body', async () => {
        const custom = await setupCustomErrorRoutes();

        const response = await executeHttpRequest(custom.app, {
          method: 'GET',
          path: '/api/custom/details-status-error',
        });

        expect(response.status).toBe(422);
        expect((response.data as any).error).toBe('Details status');
        expect(response.data).not.toHaveProperty('cause');
      });
    });

    describe('Dataset schema update rejected by existing items', () => {
      it('returns the failing items so clients can report how many items fail', async () => {
        const context = await createDefaultTestContext();
        const dataset = await context.mastra.datasets.create({ name: 'schema-update-parity' });
        await dataset.addItem({ input: { prompt: 'hello' } });
        const setup = await setupAdapter(context);

        const response = await executeHttpRequest(setup.app, {
          method: 'PATCH',
          path: `/api/datasets/${dataset.id}`,
          body: {
            inputSchema: {
              type: 'object',
              properties: { question: { type: 'string' } },
              required: ['question'],
            },
          },
        });

        expect(response.status).toBe(400);
        const failingItems = (response.data as any)?.cause?.failingItems;
        expect(Array.isArray(failingItems)).toBe(true);
        expect(failingItems).toHaveLength(1);
        expect(failingItems[0]).toMatchObject({ index: 0, field: 'input' });
      });
    });

    describe('Run claim conflict responses (#27638)', () => {
      // No model is needed: this regression is at the handler-to-HTTP serialization boundary.
      it.each([
        'AGENT_RESUME_ALREADY_CLAIMED',
        'WORKFLOW_RESUME_ALREADY_CLAIMED',
        'AGENT_RESUME_RUN_NOT_SUSPENDED',
        'WORKFLOW_RUN_NOT_SUSPENDED',
        'WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED',
        'WORKFLOW_TIME_TRAVEL_RUN_RUNNING',
      ] as const)('lets clients identify %s without matching message text', async code => {
        const error = new MastraError(
          { id: code, domain: ErrorDomain.MASTRA_WORKFLOW, category: ErrorCategory.USER },
          'Run conflict',
        );
        const route: ServerRoute = {
          method: 'POST',
          path: '/test/run-claim-conflict',
          responseType: 'json',
          handler: async () => handleError(error, 'Unable to resume'),
        };
        const mutableServerRoutes = SERVER_ROUTES as ServerRoute[];
        const originalLength = mutableServerRoutes.length;
        mutableServerRoutes.push(route);
        let conflictApp: any;
        try {
          ({ app: conflictApp } = await setupAdapter(context));
        } finally {
          mutableServerRoutes.splice(originalLength);
        }

        const response = await executeHttpRequest(conflictApp, {
          method: 'POST',
          path: '/api/test/run-claim-conflict',
          body: {},
        });

        expect(response.status).toBe(409);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.data).toEqual({ error: 'Run conflict', code });
      });
    });

    // Route prefix tests
    describe('Route Prefix', () => {
      it('should register routes at prefixed paths without double /api', async () => {
        // Create a new adapter with a custom prefix
        const prefixedSetup = await setupAdapter(context, { prefix: '/v2' });
        const prefixedApp = prefixedSetup.app;

        // Request the expected path: /v2/agents (not /v2/api/agents)
        const response = await executeHttpRequest(prefixedApp, {
          method: 'GET',
          path: '/v2/agents',
        });

        // Should succeed - routes should be at /v2/agents
        expect(response.status).toBeLessThan(400);
      });

      it('should not have routes at double /api path when prefix is set', async () => {
        // Create a new adapter with a custom prefix
        const prefixedSetup = await setupAdapter(context, { prefix: '/v2' });
        const prefixedApp = prefixedSetup.app;

        // The buggy path /v2/api/agents should NOT work
        const response = await executeHttpRequest(prefixedApp, {
          method: 'GET',
          path: '/v2/api/agents',
        });

        // Should return 404 - this path should not exist
        expect(response.status).toBe(404);
      });

      it('should normalize prefix with trailing slash', async () => {
        // Create adapter with trailing slash in prefix
        const prefixedSetup = await setupAdapter(context, { prefix: '/mastra/' });
        const prefixedApp = prefixedSetup.app;

        // Request should work at normalized path /mastra/agents (not /mastra//agents)
        const response = await executeHttpRequest(prefixedApp, {
          method: 'GET',
          path: '/mastra/agents',
        });

        // Should succeed - trailing slash should be normalized
        expect(response.status).toBeLessThan(400);
      });

      it('should normalize prefix without leading slash', async () => {
        // Create adapter without leading slash in prefix
        const prefixedSetup = await setupAdapter(context, { prefix: 'mastra' });
        const prefixedApp = prefixedSetup.app;

        // Request should work at normalized path /mastra/agents
        const response = await executeHttpRequest(prefixedApp, {
          method: 'GET',
          path: '/mastra/agents',
        });

        // Should succeed - leading slash should be added
        expect(response.status).toBeLessThan(400);
      });

      it('should not have routes at double-slash path when prefix has trailing slash', async () => {
        // Create adapter with trailing slash in prefix
        const prefixedSetup = await setupAdapter(context, { prefix: '/mastra/' });
        const prefixedApp = prefixedSetup.app;

        // The double-slash path /mastra//agents should NOT work
        const response = await executeHttpRequest(prefixedApp, {
          method: 'GET',
          path: '/mastra//agents',
        });

        // Should return 404 - double-slash path should not exist
        expect(response.status).toBe(404);
      });
    });
  });
}
