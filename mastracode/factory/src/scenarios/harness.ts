/**
 * Shared harness for Factory scenario tests.
 *
 * Boots a real `MastraFactory` on in-memory LibSQL with its real HTTP routes, and fakes only the
 * outermost edges at the wire: the model (OpenAI Responses API), GitHub (signed webhooks in, REST
 * out) and Linear (GraphQL). Everything between — routes, storage, boards, transitions, the
 * dispatcher, agent runs and Factory tools — runs for real. See `README.md`.
 */
import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto';

import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest, FixtureResponse } from '@copilotkit/aimock';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { IMastraAuthProvider } from '@mastra/core/server';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import {
  CREATE_AGENT_CONTROLLER_SESSION_ROUTE,
  SEND_AGENT_CONTROLLER_MESSAGE_ROUTE,
} from '@mastra/server/handlers/agent-controller';
import { Hono } from 'hono';
import { expect, vi } from 'vitest';

import { FACTORY_INTERACTIVE_KEY } from '../auth.js';
import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { LinearIntegration } from '../integrations/linear/integration.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';

export const ORG = 'scenario-org';
export const USER = 'scenario-user';
export const MODEL_ID = 'openai/gpt-5.6-sol';
const WEBHOOK_SECRET = 'scenario-webhook-secret';
const GITHUB_INSTALLATION = 123;

class ScenarioSandbox extends MastraSandbox {
  readonly id = randomUUID();
  readonly name = 'Scenario sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'Scenario sandbox' });
  }

  async executeCommand(command: string) {
    return {
      success: true,
      exitCode: 0,
      stdout: command === 'pwd' ? '/home/test\n' : '',
      stderr: '',
      executionTimeMs: 0,
    };
  }
}

/** A model turn that calls one Factory tool. */
export function toolCall(name: string, args: unknown): FixtureResponse {
  return { toolCalls: [{ name, arguments: JSON.stringify(args) }] };
}

/** A model turn that just replies with text. */
export function reply(text: string): FixtureResponse {
  return { content: text };
}

/** One request the model received: the whole input serialized, plus the Factory role it ran as. */
export interface ModelRequest {
  text: string;
  role: string | undefined;
  /** Revision the run was told to pass to `factory_transition_work_item`, when present. */
  revision: number | undefined;
}

/** Decide how the model answers a request. Return undefined to reply "Acknowledged.". */
export type ModelScript = (request: ModelRequest) => FixtureResponse | undefined;

/** Script: the first run in `role` moves its card to `stage`, then the model just acknowledges. */
export function handOff(role: string, stage: string): ModelScript {
  let done = false;
  return request => {
    if (done || request.role !== role || request.revision === undefined) return undefined;
    done = true;
    return toolCall('factory_transition_work_item', {
      stage,
      expectedRevision: request.revision,
      rationale: `${role} finished.`,
    });
  };
}

/** Reads the Factory role and the revision to pass on from what the model was sent. */
export function modelRequest(req: ChatCompletionRequest): ModelRequest {
  const text = JSON.stringify(req.messages);
  const revision = [...text.matchAll(/expectedRevision (\d+)/g)].at(-1)?.[1];
  return {
    text,
    role: [...text.matchAll(/Role: ([a-z0-9_-]+)/gi)].at(-1)?.[1],
    revision: revision === undefined ? undefined : Number(revision),
  };
}

/** GitHub App auth signs a JWT locally before any request, so the key must be real. */
const GITHUB_APP_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs1', format: 'pem' })
  .toString();

export interface LinearIssueFixture {
  id: string;
  identifier: string;
  title: string;
  url: string;
  teamId: string;
  teamKey: string;
}

export interface FactoryScenario {
  factory: MastraFactory;
  storage: LibSQLFactoryStorage;
  workItems: WorkItemsStorage;
  /** Every request the model received, in order. */
  modelRequests: ModelRequest[];
  /** Replace how the model answers; scripts are tried in order. */
  setModel(...scripts: ModelScript[]): void;
  api(method: string, path: string, body?: unknown): Promise<Response>;
  /** Call the API and return its JSON body, failing on an unexpected status. */
  json<T = any>(method: string, path: string, body?: unknown, status?: number): Promise<T>;
  /** Create a Factory project with auto-run on and a default model. */
  createProject(name: string): Promise<{ id: string }>;
  /** Connect a GitHub repository to a project. Returns its slug and external id. */
  connectGithubRepository(
    factoryProjectId: string,
    slug: string,
  ): Promise<{ slug: string; externalId: string; repositoryId: string; projectRepositoryId: string }>;
  /** Deliver a signed GitHub webhook to `/web/github/webhook`. */
  githubWebhook(event: string, payload: Record<string, unknown>): Promise<Response>;
  /**
   * Open a user session on a connected repository the way the web app does, and send it messages
   * through the server's agent-controller routes as the signed-in user.
   */
  openUserSession(projectRepositoryId: string): Promise<{ sessionId: string; send(text: string): Promise<void> }>;
  /** Issues the fake Linear API returns, keyed by team id. */
  linearIssues: LinearIssueFixture[];
  /** Connect Linear for the org with `teamId` selected as an intake source. */
  connectLinear(teamId: string): Promise<void>;
  /** Wait until a card matches. */
  waitForCard(id: string, expected: Partial<WorkItemRow>, timeout?: number): Promise<WorkItemRow>;
  /** The kickoff the model received for a role on a card (the first request mentioning the card title). */
  kickoff(role: string, title: string): string | undefined;
  /** Roles that started runs on a project, from the audit log. */
  startedRoles(factoryProjectId: string): Promise<string[]>;
  close(): Promise<void>;
}

export interface FactoryScenarioOptions {
  includeDefaultBoards?: boolean;
}

/** Boot a Factory for a scenario. Always `close()` it (use `useFactoryScenario` in suites). */
export async function startFactoryScenario(options: FactoryScenarioOptions = {}): Promise<FactoryScenario> {
  vi.stubEnv('OPENAI_API_KEY', 'sk-scenario');
  const modelRequests: ModelRequest[] = [];
  let scripts: ModelScript[] = [];
  const linearIssues: LinearIssueFixture[] = [];
  const realFetch = globalThis.fetch;

  // The model is a real AIMock server speaking the OpenAI wire protocol, reached through
  // OPENAI_BASE_URL — the same switch `factory dev` honors (see scenarios/README.md).
  const aimock = new LLMock({ port: 0 });
  aimock.on({ predicate: () => true }, (req: ChatCompletionRequest) => {
    const request = modelRequest(req);
    modelRequests.push(request);
    for (const script of scripts) {
      const response = script(request);
      if (response) return response;
    }
    return reply('Acknowledged.');
  });
  await aimock.start();
  vi.stubEnv('OPENAI_BASE_URL', `${aimock.url.replace(/\/+$/, '')}/v1`);

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const origin = URL.canParse(url) ? new URL(url).origin : '';
    const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
    if (origin === 'https://api.linear.app') return linearGraphql(body, linearIssues);
    if (origin === 'https://api.github.com') {
      if (/\/app\/installations\/\d+\/access_tokens$/.test(new URL(url).pathname)) {
        return Response.json(
          { token: 'ghs_scenario', expires_at: new Date(Date.now() + 3_600_000).toISOString() },
          { status: 201 },
        );
      }
      // Outbound GitHub writes (comments, labels, reconcile sweeps) are not under test here.
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (origin.startsWith('http://') && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
      return realFetch(input, init);
    throw new Error(`Unexpected external request: ${url}`);
  });

  const storage = new LibSQLFactoryStorage({ id: `scenario-${randomUUID()}`, url: ':memory:' });
  const github = new GithubIntegration({
    appId: '123',
    privateKey: GITHUB_APP_KEY,
    clientId: 'test-client',
    clientSecret: 'test-secret',
    slug: 'factory-scenario',
    webhookSecret: WEBHOOK_SECRET,
  });
  const linear = new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
  const factory = new MastraFactory({
    storage,
    // Integration routes (webhooks, Linear intake) only mount when auth is on.
    auth: {
      name: 'scenario',
      authenticateToken: async () => ({ id: USER, organizationId: ORG }),
      authorizeUser: async () => true,
    } as unknown as IMastraAuthProvider,
    integrations: [github, linear],
    sandbox: () => new ScenarioSandbox(),
    stateSecret: 'factory-scenario-state-secret-0123456789',
    configVersion: 'scenario-v1',
    includeDefaultBoards: options.includeDefaultBoards ?? true,
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
  });

  const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser', { workosId: USER, organizationId: ORG });
    await next();
  });
  let args!: Awaited<ReturnType<MastraFactory['prepare']>>;
  let mastra!: Mastra;
  try {
    args = await factory.prepare();
    mastra = new Mastra(args);
    await factory.finalize();
    const routes = args.server?.apiRoutes ?? [];
    mountApiRoutes(app, routes);
    // Integration routes (GitHub, Linear, ...) are built per Mastra instance.
    for (const route of routes) {
      if ('createHandler' in route && typeof route.createHandler === 'function')
        app.on(route.method, route.path, (await route.createHandler({ mastra })) as never);
    }
    await storage
      .getDomain<ModelCredentialsStorage>('model-credentials')
      .setCredential({ orgId: ORG }, 'openai', { type: 'api_key', key: 'sk-scenario' });
    // A signed-in person's own sessions run on their personal key.
    await storage
      .getDomain<ModelCredentialsStorage>('model-credentials')
      .setCredential({ orgId: ORG, userId: USER }, 'openai', { type: 'api_key', key: 'sk-scenario-user' });
  } catch (error) {
    // A half-built scenario never reaches close(); undo the global stubs here so later tests
    // see the original error instead of "Unexpected external request".
    await factory.shutdown().catch(() => {});
    await storage.close().catch(() => {});
    fetchSpy.mockRestore();
    await aimock.stop();
    vi.unstubAllEnvs();
    throw error;
  }

  const workItems = storage.getDomain<WorkItemsStorage>('work-items');
  const api = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  const json = async (method: string, path: string, body?: unknown, status?: number) => {
    const response = await api(method, path, body);
    const text = await response.text();
    if (status !== undefined) expect(response.status, `${method} ${path}: ${text}`).toBe(status);
    else expect(response.ok, `${method} ${path} -> ${response.status}: ${text}`).toBe(true);
    return text ? JSON.parse(text) : undefined;
  };
  let repoCounter = 0;

  return {
    factory,
    storage,
    workItems,
    modelRequests,
    linearIssues,
    setModel: (...next) => {
      scripts = next;
    },
    api: (method, path, body) => api(method, path, body),
    json,
    async createProject(name) {
      const { project } = await json('POST', '/web/factory/projects', { name });
      await json('PATCH', `/web/factory/projects/${project.id}`, { autoRunEnabled: true, defaultModelId: MODEL_ID });
      return project;
    },
    async connectGithubRepository(factoryProjectId, slug) {
      const sourceControl = github.sourceControlStorage;
      const installation = await sourceControl.installations.upsert({
        orgId: ORG,
        connectedByUserId: USER,
        externalId: String(GITHUB_INSTALLATION),
      });
      const externalId = String(456 + repoCounter++);
      const repository = await sourceControl.repositories.upsert({
        orgId: ORG,
        input: { installationId: installation.id, externalId, slug, defaultBranch: 'main' },
      });
      const connection = await sourceControl.connections.create({
        orgId: ORG,
        factoryProjectId,
        installationId: installation.id,
        createdByUserId: USER,
      });
      const link = await sourceControl.projectRepositories.link({
        orgId: ORG,
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: USER,
        sandboxProvider: 'local',
        sandboxWorkdir: `/tmp/scenario-${externalId}`,
      });
      return { slug, externalId, repositoryId: repository.id, projectRepositoryId: link.id };
    },
    async githubWebhook(event, payload) {
      const body = JSON.stringify({ installation: { id: GITHUB_INSTALLATION }, ...payload });
      return api('POST', '/web/github/webhook', body, {
        'x-github-event': event,
        'x-github-delivery': randomUUID(),
        'x-hub-signature-256': `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`,
      });
    },
    async openUserSession(projectRepositoryId) {
      const { session } = await json('POST', `/web/source-control/projects/${projectRepositoryId}/sessions`, {});
      const sessionId: string = session.sessionId;
      // What the server's auth layer and Factory's gate put on a signed-in person's request.
      const requestContext = () => {
        const context = new RequestContext();
        context.set('user', { workosId: USER, organizationId: ORG });
        context.set(FACTORY_INTERACTIVE_KEY, true);
        return context;
      };
      const route = { mastra, controllerId: 'code', resourceId: sessionId } as const;
      await CREATE_AGENT_CONTROLLER_SESSION_ROUTE.handler({ ...route, requestContext: requestContext() } as never);
      return {
        sessionId,
        send: async message => {
          await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
            ...route,
            message,
            requestContext: requestContext(),
          } as never);
        },
      };
    },
    async connectLinear(teamId) {
      await linear.upsertConnection({
        orgId: ORG,
        userId: USER,
        accessToken: 'linear-token',
        refreshToken: 'linear-refresh',
        expiresAt: new Date(Date.now() + 3_600_000),
        scope: 'read,write',
        workspaceName: 'Scenario',
        workspaceUrlKey: 'scenario',
      });
      await json('PUT', '/web/intake/config', { linear: { enabled: true, sourceIds: [teamId] } });
    },
    async waitForCard(id, expected, timeout = 15_000) {
      let card: WorkItemRow | null = null;
      await vi.waitFor(
        async () => {
          card = await workItems.get({ orgId: ORG, id });
          expect(card).toMatchObject(expected);
        },
        { timeout },
      );
      return card!;
    },
    kickoff(role, title) {
      return modelRequests.find(request => request.role === role && request.text.includes(title))?.text;
    },
    async startedRoles(factoryProjectId) {
      const { events } = await storage
        .getDomain<AuditStorage>('audit')
        .list({ orgId: ORG, factoryProjectId, actions: ['factory.run.started'] });
      return events.map(event => String(event.metadata.role)).sort();
    },
    async close() {
      try {
        await factory.shutdown();
        await mastra.stopWorkers();
        await storage.close();
      } finally {
        fetchSpy.mockRestore();
        await aimock.stop();
        vi.unstubAllEnvs();
      }
    },
  };
}

/** Minimal Linear GraphQL: answers issue listings with `issues`; everything else gets empty data. */
function linearGraphql(body: string, issues: LinearIssueFixture[]): Response {
  const { query } = JSON.parse(body) as { query: string };
  const nodes = issues.map(issue => ({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    priorityLabel: 'No priority',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    state: { name: 'Todo', type: 'unstarted' },
    assignee: null,
    creator: { name: 'Scenario User' },
    team: { id: issue.teamId, key: issue.teamKey, name: issue.teamKey },
    project: null,
    labels: { nodes: [] },
  }));
  const page = { nodes, pageInfo: { hasNextPage: false, endCursor: null } };
  const data = /issues\s*\(/.test(query) ? { issues: page, team: { issues: page } } : {};
  return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
}
