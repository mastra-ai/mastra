import { Agent } from '@mastra/core/agent';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { DEFAULT_ROLES, FGADeniedError, StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SimpleAuth } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { DispatchRouteInput, ServerRoute } from '@mastra/server/server-adapter';
import { createRoute, dispatchRoute, SERVER_ROUTES } from '@mastra/server/server-adapter';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

/**
 * Configuration for the route dispatch parity test suite
 */
export interface RouteDispatchParityTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Build an app for the given Mastra instance, run the adapter's `init()`, and
   * return a way to send HTTP requests to it by path (e.g. `/api/agents?x=1`).
   */
  startServer: (mastra: Mastra) => Promise<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
    close?: () => Promise<void>;
  }>;
}

type TestUser = { id: string; role: string; studioRole: string };

const USERS: Record<string, TestUser> = {
  'owner-token': { id: 'user-owner', role: 'owner', studioRole: 'owner' },
  'member-token': { id: 'user-member', role: 'member', studioRole: 'member' },
  'member2-token': { id: 'user-member2', role: 'member', studioRole: 'member' },
  // Read-only on the server, but allowed to execute when authenticated as a Studio user.
  'viewer-token': { id: 'user-viewer', role: 'viewer', studioRole: 'member' },
};

/** `type:id` → user ids granted any permission on that resource (`*` = every user). */
const FGA_GRANTS: Record<string, string[]> = {
  'agent:test-agent': ['*'],
  'agent:locked-agent': ['user-owner'],
  'workflow:test-workflow': ['*'],
  'workflow:locked-workflow': ['user-owner'],
  'tool:test-tool': ['*'],
  'tool:locked-tool': ['user-owner'],
};

/**
 * In-memory relationship store standing in for an external FGA service (WorkOS, OpenFGA, ...).
 * Threads are granted to everyone so that thread ownership is decided by the handlers.
 */
class TupleFGAProvider implements IFGAProvider<TestUser> {
  async check(user: TestUser, { resource }: { resource: { type: string; id: string } }): Promise<boolean> {
    if (resource.type === 'thread') return true;
    const grantees = FGA_GRANTS[`${resource.type}:${resource.id}`] ?? [];
    return grantees.includes('*') || grantees.includes(user.id);
  }

  async require(user: TestUser, params: { resource: { type: string; id: string }; permission: any }): Promise<void> {
    if (!(await this.check(user, params))) {
      throw new FGADeniedError(user, params.resource, params.permission);
    }
  }

  async filterAccessible<T extends { id: string }>(user: TestUser, resources: T[], resourceType: string) {
    const allowed: T[] = [];
    for (const resource of resources) {
      if (await this.check(user, { resource: { type: resourceType, id: resource.id } })) allowed.push(resource);
    }
    return allowed;
  }
}

function findRoute(method: string, path: string): ServerRoute {
  const route = SERVER_ROUTES.find(r => r.method === method && r.path === path);
  if (!route) throw new Error(`No server route ${method} ${path}`);
  return route as ServerRoute;
}

function createParityMastra(probeCases: Map<string, { route: ServerRoute; input: DispatchRouteInput }>) {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  const makeAgent = (id: string) =>
    new Agent({
      id,
      name: id,
      instructions: 'You are a test agent',
      model: createMockModel({ mockText: `hello from ${id}` }),
      memory,
    });

  const approvalStep = createStep({
    id: 'approval',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) return suspend({ reason: 'needs approval' });
      return { approved: resumeData.approved };
    },
  });
  const makeWorkflow = (id: string) =>
    createWorkflow({
      id,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
    })
      .then(approvalStep)
      .commit();

  const makeTool = (id: string) =>
    createTool({
      id,
      description: 'Echoes its input',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });

  // Same shape step 3's `/api/mcp` route has: method ALL, so no RBAC permission of its own;
  // it forwards the adapter-authenticated ServerContext to dispatchRoute.
  const probe = createRoute({
    method: 'ALL',
    path: '/__dispatch',
    responseType: 'json',
    queryParamSchema: z.object({ case: z.string() }),
    handler: async ({ case: caseId, mastra, requestContext, abortSignal, registeredTools, taskStore, request }) => {
      const probeCase = probeCases.get(caseId)!;
      return dispatchRoute(probeCase.route, probeCase.input, {
        mastra,
        requestContext,
        abortSignal,
        registeredTools,
        taskStore,
        routePrefix: '/api',
        request,
      });
    },
  });

  const tokens = Object.fromEntries(Object.entries(USERS));
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    agents: { 'test-agent': makeAgent('test-agent'), 'locked-agent': makeAgent('locked-agent') },
    workflows: { 'test-workflow': makeWorkflow('test-workflow'), 'locked-workflow': makeWorkflow('locked-workflow') },
    tools: { 'test-tool': makeTool('test-tool'), 'locked-tool': makeTool('locked-tool') },
    server: {
      auth: new SimpleAuth<TestUser>({ tokens, mapUserToResourceId: user => user.id }),
      rbac: new StaticRBACProvider<TestUser>({ roles: DEFAULT_ROLES, getUserRoles: user => [user.role] }),
      fga: new TupleFGAProvider(),
      apiRoutes: [probe as any],
    },
    studio: {
      auth: new SimpleAuth<TestUser>({ tokens, mapUserToResourceId: user => user.id }),
      rbac: new StaticRBACProvider<TestUser>({ roles: DEFAULT_ROLES, getUserRoles: user => [user.studioRole] }),
    },
  });

  return { mastra, memory };
}

type ParityRequest = {
  token: string;
  studio?: boolean;
  method: string;
  path: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

type Outcome = { status: number; body: any };

/**
 * `dispatchRoute` is how in-process callers (the upcoming `/api/mcp` server) invoke server routes.
 * It must allow and deny exactly what a real HTTP request to the same route allows and denies,
 * for the same authenticated user: RBAC (server and Studio providers), FGA, schema validation
 * and handler-level ownership checks.
 */
export function createRouteDispatchParityTestSuite(config: RouteDispatchParityTestSuiteConfig) {
  const { suiteName = 'Route dispatch parity', startServer } = config;

  describe(suiteName, () => {
    const probeCases = new Map<string, { route: ServerRoute; input: DispatchRouteInput }>();
    let server: Awaited<ReturnType<RouteDispatchParityTestSuiteConfig['startServer']>>;
    let memory: MockMemory;

    beforeAll(async () => {
      const setup = createParityMastra(probeCases);
      memory = setup.memory;
      server = await startServer(setup.mastra);
    });

    afterAll(async () => {
      await server?.close?.();
    });

    const headersFor = (req: ParityRequest) => ({
      authorization: `Bearer ${req.token}`,
      ...(req.studio ? { 'x-mastra-client-type': 'studio' } : {}),
    });

    const viaHttp = async (req: ParityRequest): Promise<Outcome> => {
      let path = req.path;
      for (const [key, value] of Object.entries(req.pathParams ?? {})) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      }
      const query = new URLSearchParams(req.query ?? {}).toString();
      const hasBody = req.body !== undefined;
      const response = await server.request(`/api${path}${query ? `?${query}` : ''}`, {
        method: req.method,
        headers: { ...headersFor(req), ...(hasBody ? { 'content-type': 'application/json' } : {}) },
        ...(hasBody ? { body: JSON.stringify(req.body) } : {}),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : undefined };
    };

    const viaDispatch = async (req: ParityRequest): Promise<Outcome> => {
      const caseId = String(probeCases.size);
      probeCases.set(caseId, {
        route: findRoute(req.method, req.path),
        input: { pathParams: req.pathParams, query: req.query, body: req.body },
      });
      const response = await server.request(`/__dispatch?case=${caseId}`, { headers: headersFor(req) });
      expect(response.status).toBe(200);
      const outcome = (await response.json()) as
        | { ok: true; result: any }
        | { ok: false; status: number; body: unknown };
      return outcome.ok ? { status: 200, body: outcome.result } : { status: outcome.status, body: outcome.body };
    };

    /** Sends the request both ways and asserts the same status (and same body on errors). */
    const expectParity = async (req: ParityRequest, expectedStatus: number) => {
      const http = await viaHttp(req);
      const dispatched = await viaDispatch(req);
      expect(http.status, JSON.stringify(http.body)).toBe(expectedStatus);
      expect(dispatched.status).toBe(http.status);
      if (expectedStatus >= 400) {
        expect(dispatched.body).toEqual(http.body);
      }
      return { http: http.body, dispatched: dispatched.body };
    };

    let threadCounter = 0;
    const generate = (
      token: string,
      agentId: string,
      body: unknown = { messages: 'hi', memory: { thread: `generate-thread-${++threadCounter}` } },
    ): ParityRequest => ({
      token,
      method: 'POST',
      path: '/agents/:agentId/generate',
      pathParams: { agentId },
      body,
    });

    describe('agents', () => {
      it('denies generate without agents:execute (RBAC)', async () => {
        const { http } = await expectParity(generate('viewer-token', 'test-agent'), 403);
        expect(http.message).toBe('Missing required permission: agents:execute');
      });

      it('allows generate for a member and returns the same text', async () => {
        const { http, dispatched } = await expectParity(generate('member-token', 'test-agent'), 200);
        expect(http.text).toBe('hello from test-agent');
        expect(dispatched.text).toBe(http.text);
      });

      it('denies generate on an agent the FGA provider does not grant', async () => {
        const { http } = await expectParity(generate('member-token', 'locked-agent'), 403);
        expect(http.message).toContain('FGA authorization denied');
      });

      it('allows the FGA-granted owner on the locked agent', async () => {
        await expectParity(generate('owner-token', 'locked-agent'), 200);
      });

      it('rejects an invalid body with the same validation error', async () => {
        const { http } = await expectParity(generate('member-token', 'test-agent', { messages: 42 }), 400);
        expect(http.error).toBeDefined();
      });

      it('uses the Studio RBAC provider for Studio requests', async () => {
        await expectParity(generate('viewer-token', 'test-agent'), 403);
        await expectParity({ ...generate('viewer-token', 'test-agent'), studio: true }, 200);
      });

      it('applies read permissions and FGA to agent reads', async () => {
        await expectParity({ token: 'viewer-token', method: 'GET', path: '/agents' }, 200);
        const read = (agentId: string): ParityRequest => ({
          token: 'viewer-token',
          method: 'GET',
          path: '/agents/:agentId',
          pathParams: { agentId },
        });
        await expectParity(read('test-agent'), 200);
        await expectParity(read('locked-agent'), 403);
      });
    });

    describe('workflows', () => {
      const start = (token: string, workflowId = 'test-workflow'): ParityRequest => ({
        token,
        method: 'POST',
        path: '/workflows/:workflowId/start-async',
        pathParams: { workflowId },
        body: { inputData: { value: 'x' } },
      });

      const startRun = async (token = 'member-token') => {
        const created = await viaHttp({
          token,
          method: 'POST',
          path: '/workflows/:workflowId/create-run',
          pathParams: { workflowId: 'test-workflow' },
        });
        expect(created.status).toBe(200);
        const runId = created.body.runId as string;
        const started = await viaHttp({ ...start(token), query: { runId } });
        expect(started.body.status).toBe('suspended');
        return runId;
      };

      it('denies start without workflows:execute', async () => {
        await expectParity(start('viewer-token'), 403);
      });

      it('starts the workflow for a member and suspends both ways', async () => {
        const { http, dispatched } = await expectParity(start('member-token'), 200);
        expect(http.status).toBe('suspended');
        expect(dispatched.status).toBe('suspended');
      });

      it('denies start on a workflow the FGA provider does not grant', async () => {
        await expectParity(start('member-token', 'locked-workflow'), 403);
      });

      it('resumes a suspended run for a member and denies a viewer', async () => {
        const resume = (token: string, runId: string): ParityRequest => ({
          token,
          method: 'POST',
          path: '/workflows/:workflowId/resume-async',
          pathParams: { workflowId: 'test-workflow' },
          query: { runId },
          body: { step: 'approval', resumeData: { approved: true } },
        });

        const runA = await startRun();
        const runB = await startRun();
        const viaHttpResult = await viaHttp(resume('member-token', runA));
        const viaDispatchResult = await viaDispatch(resume('member-token', runB));
        expect(viaHttpResult.status).toBe(200);
        expect(viaDispatchResult.status).toBe(200);
        expect(viaHttpResult.body.status).toBe('success');
        expect(viaDispatchResult.body.status).toBe('success');
        expect(viaDispatchResult.body.result).toEqual(viaHttpResult.body.result);

        const runC = await startRun();
        await expectParity(resume('viewer-token', runC), 403);
      });

      it('lists runs for a viewer and denies FGA-ungranted workflows', async () => {
        const runs = (workflowId: string): ParityRequest => ({
          token: 'viewer-token',
          method: 'GET',
          path: '/workflows/:workflowId/runs',
          pathParams: { workflowId },
        });
        await expectParity(runs('test-workflow'), 200);
        await expectParity(runs('locked-workflow'), 403);
      });

      it('cancels for a member and denies a viewer', async () => {
        const cancel = (token: string, runId: string): ParityRequest => ({
          token,
          method: 'POST',
          path: '/workflows/:workflowId/runs/:runId/cancel',
          pathParams: { workflowId: 'test-workflow', runId },
        });
        const runId = await startRun();
        await expectParity(cancel('viewer-token', runId), 403);

        const runA = await startRun();
        const runB = await startRun();
        const httpCancel = await viaHttp(cancel('member-token', runA));
        const dispatchedCancel = await viaDispatch(cancel('member-token', runB));
        expect(httpCancel.status).toBe(200);
        expect(dispatchedCancel).toEqual(httpCancel);
      });
    });

    describe('tools', () => {
      const execute = (token: string, toolId = 'test-tool'): ParityRequest => ({
        token,
        method: 'POST',
        path: '/tools/:toolId/execute',
        pathParams: { toolId },
        body: { data: { text: 'ping' } },
      });

      it('denies execute without tools:execute', async () => {
        await expectParity(execute('viewer-token'), 403);
      });

      it('executes for a member with the same result', async () => {
        const { http, dispatched } = await expectParity(execute('member-token'), 200);
        expect(http).toEqual({ echoed: 'ping' });
        expect(dispatched).toEqual(http);
      });

      it('denies execute on a tool the FGA provider does not grant', async () => {
        await expectParity(execute('member-token', 'locked-tool'), 403);
      });
    });

    describe('thread ownership', () => {
      it("lets the owner read their thread and denies another user's read", async () => {
        await memory.saveThread({
          thread: {
            id: 'thread-of-member',
            resourceId: 'user-member',
            title: 'private',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        const read = (token: string): ParityRequest => ({
          token,
          method: 'GET',
          path: '/memory/threads/:threadId',
          pathParams: { threadId: 'thread-of-member' },
          query: { agentId: 'test-agent' },
        });

        const { http, dispatched } = await expectParity(read('member-token'), 200);
        expect(http.id).toBe('thread-of-member');
        expect(dispatched.id).toBe('thread-of-member');
        await expectParity(read('member2-token'), 403);
      });
    });

    describe('path params', () => {
      // Over HTTP, adapters let body keys override path params (pre-existing); dispatchRoute targets
      // the resource named in the path for both FGA and the handler.
      it('authorizes and runs the agent named in the path, not a same-named body field', async () => {
        const denied = await viaDispatch(
          generate('member-token', 'locked-agent', {
            messages: 'hi',
            agentId: 'test-agent',
            memory: { thread: `generate-thread-${++threadCounter}` },
          }),
        );
        expect(denied.status).toBe(403);
        expect(denied.body.message).toContain('agent:locked-agent');

        const allowed = await viaDispatch({
          ...generate('owner-token', 'test-agent', {
            messages: 'hi',
            agentId: 'locked-agent',
            memory: { thread: `generate-thread-${++threadCounter}` },
          }),
          query: { agentId: 'locked-agent' },
        });
        expect(allowed.status).toBe(200);
        expect(allowed.body.text).toBe('hello from test-agent');
      });
    });
  });

  describe(`${suiteName} with path-scoped authorization`, () => {
    type AuthVariant = { name: string; auth: () => any; generate: number; tool: number };
    const authenticateToken = async (token: string) => USERS[token] ?? null;
    const requestPath = (request: any) => new URL(request?.raw?.url ?? request?.url ?? 'http://x/').pathname;

    const variants: AuthVariant[] = [
      {
        name: 'server.auth.rules',
        // Only the probe and agent routes are allowed; everything else falls through to deny.
        auth: () => ({ authenticateToken, rules: [{ path: ['/__dispatch', '/api/agents/*'], allow: true }] }),
        generate: 200,
        tool: 403,
      },
      {
        name: 'server.auth.authorize(path)',
        auth: () => ({
          authenticateToken,
          authorize: async (path: string) => !/^\/api\/agents\/[^/]+\/generate$/.test(path),
        }),
        generate: 403,
        tool: 200,
      },
      {
        name: 'authorizeUser(user, request)',
        auth: () =>
          new SimpleAuth<TestUser>({
            tokens: USERS,
            authorizeUser: (_user, request) => !requestPath(request).endsWith('/generate'),
          }),
        generate: 403,
        tool: 200,
      },
    ];

    for (const variant of variants) {
      describe(variant.name, () => {
        const probeCases = new Map<string, { route: ServerRoute; input: DispatchRouteInput }>();
        let server: Awaited<ReturnType<RouteDispatchParityTestSuiteConfig['startServer']>>;

        beforeAll(async () => {
          const probe = createRoute({
            method: 'ALL',
            path: '/__dispatch',
            responseType: 'json',
            queryParamSchema: z.object({ case: z.string() }),
            handler: async ({ case: caseId, mastra, requestContext, abortSignal, request }) => {
              const probeCase = probeCases.get(caseId)!;
              return dispatchRoute(probeCase.route, probeCase.input, { mastra, requestContext, abortSignal, request });
            },
          });
          const mastra = new Mastra({
            logger: false,
            agents: {
              'test-agent': new Agent({
                id: 'test-agent',
                name: 'test-agent',
                instructions: 'You are a test agent',
                model: createMockModel({ mockText: 'hello from test-agent' }),
              }),
            },
            tools: {
              'test-tool': createTool({
                id: 'test-tool',
                description: 'Echoes its input',
                inputSchema: z.object({ text: z.string() }),
                execute: async ({ text }) => ({ echoed: text }),
              }),
            },
            server: { auth: variant.auth(), apiRoutes: [probe as any] },
          });
          server = await startServer(mastra);
        });

        afterAll(async () => {
          await server?.close?.();
        });

        const both = async (method: string, path: string, filledPath: string, input: DispatchRouteInput) => {
          const headers = { authorization: 'Bearer member-token', 'content-type': 'application/json' };
          const httpResponse = await server.request(`/api${filledPath}`, {
            method,
            headers,
            ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
          });
          const httpText = await httpResponse.text();
          const caseId = String(probeCases.size);
          probeCases.set(caseId, { route: findRoute(method, path), input });
          const probeResponse = await server.request(`/__dispatch?case=${caseId}`, { headers });
          expect(probeResponse.status).toBe(200);
          const outcome = (await probeResponse.json()) as
            | { ok: true; result: any }
            | { ok: false; status: number; body: unknown };
          return {
            http: { status: httpResponse.status, body: httpText ? JSON.parse(httpText) : undefined },
            dispatched: outcome.ok
              ? { status: 200, body: outcome.result }
              : { status: outcome.status, body: outcome.body },
          };
        };

        const expectAgree = (result: Awaited<ReturnType<typeof both>>, expectedStatus: number) => {
          expect(result.http.status, `http ${JSON.stringify(result.http.body).slice(0, 120)}`).toBe(expectedStatus);
          expect(result.dispatched.status, `dispatch ${JSON.stringify(result.dispatched.body).slice(0, 120)}`).toBe(
            expectedStatus,
          );
          if (expectedStatus >= 400) expect(result.dispatched.body).toEqual(result.http.body);
        };

        it(`agent generate → ${variant.generate} both ways`, async () => {
          expectAgree(
            await both('POST', '/agents/:agentId/generate', '/agents/test-agent/generate', {
              pathParams: { agentId: 'test-agent' },
              body: { messages: 'hi' },
            }),
            variant.generate,
          );
        });

        it(`tool execute → ${variant.tool} both ways`, async () => {
          expectAgree(
            await both('POST', '/tools/:toolId/execute', '/tools/test-tool/execute', {
              pathParams: { toolId: 'test-tool' },
              body: { data: { text: 'ping' } },
            }),
            variant.tool,
          );
        });

        it('a requiresAuth:false route stays public both ways', async () => {
          expectAgree(await both('GET', '/auth/capabilities', '/auth/capabilities', {}), 200);
        });
      });
    }
  });

  describe(`${suiteName} without auth`, () => {
    const probeCases = new Map<string, { route: ServerRoute; input: DispatchRouteInput }>();
    let server: Awaited<ReturnType<RouteDispatchParityTestSuiteConfig['startServer']>>;

    beforeAll(async () => {
      const probe = createRoute({
        method: 'ALL',
        path: '/__dispatch',
        responseType: 'json',
        queryParamSchema: z.object({ case: z.string() }),
        handler: async ({ case: caseId, mastra, requestContext, abortSignal }) => {
          const probeCase = probeCases.get(caseId)!;
          return dispatchRoute(probeCase.route, probeCase.input, { mastra, requestContext, abortSignal });
        },
      });
      const mastra = new Mastra({
        logger: false,
        tools: {
          'test-tool': createTool({
            id: 'test-tool',
            description: 'Echoes its input',
            inputSchema: z.object({ text: z.string() }),
            execute: async ({ text }) => ({ echoed: text }),
          }),
        },
        server: { apiRoutes: [probe as any] },
      });
      server = await startServer(mastra);
    });

    afterAll(async () => {
      await server?.close?.();
    });

    it('allows the same requests with no auth configured', async () => {
      const http = await server.request('/api/tools/test-tool/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: { text: 'ping' } }),
      });
      probeCases.set('0', {
        route: findRoute('POST', '/tools/:toolId/execute'),
        input: { pathParams: { toolId: 'test-tool' }, body: { data: { text: 'ping' } } },
      });
      const dispatched = await (await server.request('/__dispatch?case=0')).json();
      expect(http.status).toBe(200);
      expect(dispatched).toEqual({ ok: true, result: await http.json() });
    });
  });
}
