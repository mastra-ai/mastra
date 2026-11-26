import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LLMock } from '@copilotkit/aimock';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createSkill } from '@mastra/core/skills';
import type { InlineSkill } from '@mastra/core/skills';
import type { FactoryStorage } from '@mastra/core/storage';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FactoryBoardEngineFactory } from '../board-engine/engine.js';
import { createWorkflowBoardEngine } from '../board-engine/workflow-engine.js';
import { defineBoard } from '../boards/index.js';
import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import { factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { isolatedPostgresSchemaForTests } from '../storage/test-utils.js';
import type { RuleGroup } from './rule-group.js';

class TestSandbox extends MastraSandbox {
  readonly id = randomUUID();
  readonly name = 'Phase runtime sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'Phase runtime sandbox' });
  }

  async executeCommand(command: string) {
    return {
      exitCode: 0,
      stdout: command === 'pwd' ? '/home/test\n' : '',
      stderr: '',
      success: true,
      executionTimeMs: 0,
    };
  }
}

const LOW_EFFORT: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
};

const ORG = 'phase-org';

const PUBLISH = 'Publish the card you were given.';
const publishSkill = createSkill({ name: 'publish', description: 'Publish a card', instructions: PUBLISH });

/**
 * Cards enter Build through the project's intake route, not a person, so only the phase's start
 * rule decides whether their run starts. Build ends when its agent has listed the work items; the
 * agent then moves the card itself.
 */
const release = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'backlog',
  phases: {
    backlog: {
      name: 'Backlog',
      kind: 'resting',
      nextPhases: ['build'],
    },
    build: {
      name: 'Build',
      kind: 'working',
      runner: { context: 'publisher', skill: 'publish', instructions: 'Keep it short.' },
      autoStart: true,
      autoStartWhen: LOW_EFFORT,
      exitTool: 'factory_list_work_items',
      nextPhases: ['done', 'backlog'],
    },
    done: { name: 'Done', kind: 'terminal' },
  },
});

function sse(events: unknown[]): Response {
  return new Response(
    events.map(event => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

type ToolCall = { name: string; args: Record<string, unknown> };

/** The first outcome the factory-phase signal lists for the agent to report. */
function firstOutcome(text: string): string | undefined {
  return [...text.matchAll(/Outcomes: ([a-z-]+):/g)].at(-1)?.[1];
}

/** A fake OpenAI model: `decide` picks a tool call for each request, or the model answers "Done.". */
function fakeModel(requests: string[], decide: (text: string) => ToolCall | undefined) {
  let calls = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
    const text = JSON.stringify(JSON.parse(body).input);
    requests.push(text);
    const call = decide(text);
    if (call) {
      calls += 1;
      const item = {
        id: `fc_${calls}`,
        type: 'function_call',
        call_id: `call_${calls}`,
        name: call.name,
        arguments: JSON.stringify(call.args),
      };
      return sse([
        { type: 'response.created', response: { id: `resp_${calls}`, created_at: 1, model: 'phase-test' } },
        { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } },
        { type: 'response.function_call_arguments.delta', item_id: item.id, output_index: 0, delta: item.arguments },
        { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed' } },
        {
          type: 'response.completed',
          response: { id: `resp_${calls}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
        },
      ]);
    }
    const item = { id: 'msg_ack', type: 'message', role: 'assistant', content: [] };
    return sse([
      { type: 'response.created', response: { id: 'resp_ack', created_at: 1, model: 'phase-test' } },
      { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'Done.' },
      { type: 'response.output_item.done', output_index: 0, item },
      {
        type: 'response.completed',
        response: {
          id: 'resp_ack',
          status: 'completed',
          incomplete_details: null,
          usage: {
            input_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 1,
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      },
    ]);
  });
}

/**
 * Asked to publish, the agent runs `factory_list_work_items` and then reports the first outcome
 * the factory-phase signal offers with `factory_report_outcome`.
 */
function publisher(): (text: string) => ToolCall | undefined {
  const steps = new Map<string, number>();
  return text => {
    const title = text.includes(PUBLISH) ? text.match(/quick fix|large rewrite/)?.[0] : undefined;
    const step = title ? (steps.get(title) ?? 0) : 2;
    if (!title || step >= 2) return undefined;
    steps.set(title, step + 1);
    if (step === 0) return { name: 'factory_list_work_items', args: {} };
    return { name: 'factory_report_outcome', args: { outcome: firstOutcome(text), reason: 'Published.' } };
  };
}

async function bootFactory(
  storage: FactoryStorage,
  board: ReturnType<typeof defineBoard>,
  skills?: InlineSkill[],
  pubsub?: RedisStreamsPubSub,
  boardEngine?: FactoryBoardEngineFactory,
) {
  const github = new GithubIntegration({
    appId: '123',
    privateKey: 'test-key',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    slug: 'phase-test',
  });
  const factory = new MastraFactory({
    storage,
    ...(pubsub ? { pubsub } : {}),
    auth: null,
    integrations: [github],
    sandbox: () => new TestSandbox(),
    stateSecret: 'phase-runtime-test-state-secret',
    boards: [board],
    ...(skills ? { skills } : {}),
    configVersion: 'phase-runtime-v1',
    ...(boardEngine ? { boardEngine } : {}),
    secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
  });
  const args = await factory.prepare();
  const mastra = new Mastra(args);
  await factory.finalize();
  const close = async () => {
    await factory.shutdown();
    await mastra.shutdown();
  };
  return { args, mastra, sourceControl: github.sourceControlStorage, close };
}

/** A real Factory with one linked GitHub repository, driven over HTTP. */
async function startFactory(
  board: ReturnType<typeof defineBoard>,
  landing: string,
  skills?: InlineSkill[],
  {
    evented,
    boardEngine,
  }: {
    evented?: { storage: PgFactoryStorage; pubsub: RedisStreamsPubSub };
    boardEngine?: FactoryBoardEngineFactory;
  } = {},
) {
  vi.stubEnv('OPENAI_API_KEY', 'sk-phase-test');
  const storage = evented?.storage ?? new LibSQLFactoryStorage({ id: 'phase-runtime', url: ':memory:' });
  const runtime = await bootFactory(storage, board, skills, evented?.pubsub, boardEngine);
  const { args, mastra, sourceControl } = runtime;
  const close = async () => {
    await runtime.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  };
  const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
  app.use('*', async (c, next) => {
    c.set('factoryAuthUser', { workosId: 'phase-user', organizationId: ORG });
    await next();
  });
  mountApiRoutes(app, args.server?.apiRoutes?.flat() ?? []);
  await storage
    .getDomain<ModelCredentialsStorage>('model-credentials')
    .setCredential({ orgId: ORG }, 'openai', { type: 'api_key', key: 'sk-phase-test' });
  const send = (method: string, path: string, body: unknown) =>
    app.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const { project } = await (await send('POST', '/web/factory/projects', { name: 'Phase project' })).json();
  // No project setting starts runs: only the phase's own start rule may.
  expect(
    (await send('PATCH', `/web/factory/projects/${project.id}`, { defaultModelId: 'openai/gpt-5.6-sol' })).status,
  ).toBe(200);
  const installation = await sourceControl.installations.upsert({
    orgId: ORG,
    connectedByUserId: 'phase-user',
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: ORG,
    input: { installationId: installation.id, externalId: '456', slug: 'phase/project', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: ORG,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'phase-user',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId: ORG,
    connectionId: connection.id,
    repositoryId: repository.id,
  });

  // The project's intake route files new cards straight into the phase the test exercises.
  const route = await send('POST', `/web/factory/projects/${project.id}/intake-routes`, {
    name: `New cards go to ${landing}`,
    target: { boardKey: board.id, phaseKey: landing },
  });
  expect(route.status, await route.clone().text()).toBe(201);

  const workItems = storage.getDomain<WorkItemsStorage>('work-items');
  const card = async (title: string, labels: string[]): Promise<Card> => {
    const response = await send('POST', `/web/factory/projects/${project.id}/work-items`, {
      title,
      externalSource: { integrationId: 'github', type: 'issue', externalId: `phase:${title}` },
      metadata: { authorTrusted: true, labels },
    });
    const created = await response.json();
    expect(created, JSON.stringify(created)).toMatchObject({ workItem: { board: board.id } });
    return created.workItem as Card;
  };
  const read = async (item: Card) => (await workItems.get({ orgId: ORG, id: item.id }))!;
  const decisionsFor = async (item: Card) =>
    (await workItems.listDeferredDecisions(ORG, project.id)).filter(record => record.workItemId === item.id);
  return { project, workItems, card, read, decisionsFor, close, storage, mastra, send, projectRepository };
}

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const redisUrl = process.env.FACTORY_TEST_REDIS_URL;

const workerPrefix = process.env.FACTORY_PHASE_TEST_WORKER_PREFIX;
const workerTestName = 'runs the evented Factory worker fixture';
const approvalCallId = 'call_write_restart_tasks';
const restartTask = {
  id: 'restart-task',
  content: 'Record the approval across restart',
  status: 'pending',
  activeForm: 'Recording the approval across restart',
};
const restartReply = 'The approved task is recorded.';

function phaseUserContext() {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'phase-user', organizationId: ORG });
  return requestContext;
}

function spawnPhaseWorker(connectionString: string, keyPrefix: string, stopPath: string, sessionId?: string) {
  const factoryDir = fileURLToPath(new URL('../..', import.meta.url));
  const processHandle = spawn(
    process.execPath,
    [
      join(factoryDir, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--pool=threads',
      'src/rules/board-phase-runtime.test.ts',
      '-t',
      workerTestName,
    ],
    {
      cwd: factoryDir,
      env: {
        ...process.env,
        MASTRA_WORKERS: '',
        FACTORY_TEST_POSTGRES_URL: connectionString,
        FACTORY_PHASE_TEST_WORKER_PREFIX: keyPrefix,
        FACTORY_PHASE_TEST_WORKER_STOP: stopPath,
        ...(sessionId ? { FACTORY_PHASE_TEST_PARK_SESSION: sessionId } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const closed = once(processHandle, 'close');
  let output = '';
  processHandle.stdout.on('data', chunk => (output += String(chunk)));
  processHandle.stderr.on('data', chunk => (output += String(chunk)));
  return {
    processHandle,
    closed,
    output: () => output,
    async stop() {
      writeFileSync(stopPath, '');
      const kill = setTimeout(() => processHandle.kill('SIGKILL'), 10_000);
      try {
        await closed;
      } finally {
        clearTimeout(kill);
      }
    },
  };
}

it.skipIf(!workerPrefix)(
  workerTestName,
  async () => {
    const storage = new PgFactoryStorage({ id: 'factory-test', connectionString: postgresUrl! });
    const pubsub = new RedisStreamsPubSub({ url: redisUrl!, keyPrefix: workerPrefix! });
    try {
      const sessionId = process.env.FACTORY_PHASE_TEST_PARK_SESSION;
      const runtime = sessionId
        ? await startFactory(release, 'build', [publishSkill], { evented: { storage, pubsub } })
        : await bootFactory(storage, release, [publishSkill], pubsub);
      try {
        if (sessionId && 'send' in runtime) {
          const response = await runtime.send(
            'POST',
            `/web/source-control/projects/${runtime.projectRepository.id}/sessions`,
            {
              sessionId,
            },
          );
          expect(response.status, await response.text()).toBe(200);
          const [controller] = Object.values(runtime.mastra.listAgentControllers());
          const requestContext = phaseUserContext();
          const session = (await controller?.getSession(sessionId, requestContext))!;
          await session.state.set({ yolo: false });
          await session.permissions.setForTool({ toolName: 'task_write', policy: 'ask' });
          const turn = session.sendMessage({ content: 'Record the restart task.', requestContext });
          void turn.catch(error => console.error(error));
          await expect.poll(() => session.hasPersistedToolApproval(approvalCallId), { timeout: 20_000 }).toBe(true);
          console.log('factory-phase-approval-persisted');
          await expect
            .poll(() => existsSync(`${process.env.FACTORY_PHASE_TEST_WORKER_STOP!}.approve`), { timeout: 60_000 })
            .toBe(true);
          expect(
            session.respondToToolApproval({ toolCallId: approvalCallId, decision: 'approve', requestContext }).accepted,
          ).toBe(true);
          await turn;
        }
        console.log('factory-phase-worker-ready');
        await expect
          .poll(() => existsSync(process.env.FACTORY_PHASE_TEST_WORKER_STOP!), { timeout: 60_000 })
          .toBe(true);
      } finally {
        await runtime.close();
      }
    } finally {
      await pubsub.close();
      await storage.close();
    }
  },
  90_000,
);

it.skipIf(!postgresUrl || !redisUrl || !!workerPrefix).each([false, true])(
  'persists a generated title for an evented Factory session over Redis Streams and completes the turn (split worker=%s)',
  async split => {
    const title = 'Repair the Login Flow';
    const model = new LLMock({ port: 0 });
    const keyPrefix = `factory-title-${randomUUID()}`;
    const pubsub = new RedisStreamsPubSub({ url: redisUrl!, keyPrefix });
    const connectionString = await isolatedPostgresSchemaForTests(postgresUrl!);
    const storage = new PgFactoryStorage({ id: 'factory-test', connectionString });
    const appData = mkdtempSync(join(tmpdir(), 'factory-evented-title-'));
    const workerStop = join(appData, 'worker.stop');
    vi.stubEnv('MASTRA_APP_DATA_DIR', appData);
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_AGENT', 'evented');
    vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
    vi.stubEnv('MASTRACODE_DISABLE_TITLE_GENERATION', '0');
    model.on({ systemMessage: 'the title must be 3 to 5 words long' }, { content: title });
    model.on(
      { predicate: request => JSON.stringify(request).includes('Tasks updated:') },
      { content: 'The login flow is repaired.' },
    );
    model.onMessage(/Repair the broken login flow/, {
      toolCalls: [{ id: approvalCallId, name: 'task_write', arguments: JSON.stringify({ tasks: [restartTask] }) }],
    });

    try {
      await model.start();
      vi.stubEnv('OPENAI_BASE_URL', `${model.url.replace(/\/+$/, '')}/v1`);
      vi.stubEnv('MASTRA_WORKERS', split ? 'false' : undefined);
      const runtime = await startFactory(release, 'build', [publishSkill], { evented: { storage, pubsub } });
      const worker = split ? spawnPhaseWorker(connectionString, keyPrefix, workerStop) : undefined;
      try {
        if (worker) {
          await expect.poll(() => worker.output(), { timeout: 30_000 }).toContain('factory-phase-worker-ready');
        }
        await runtime.storage.getDomain<MemorySettingsStorage>('memory-settings').patch({
          orgId: ORG,
          userId: factoryProjectSettingsUserId(runtime.project.id),
          patch: { observerModelId: 'openai/gpt-5.4-mini' },
        });
        const sessionId = randomUUID();
        const response = await runtime.send(
          'POST',
          `/web/source-control/projects/${runtime.projectRepository.id}/sessions`,
          {
            sessionId,
          },
        );
        expect(response.status, await response.text()).toBe(200);
        const [controller] = Object.values(runtime.mastra.listAgentControllers());
        const requestContext = new RequestContext();
        requestContext.set('user', { workosId: 'phase-user', organizationId: ORG });
        const session = await controller?.getSession(sessionId, requestContext);
        expect(session).toBeDefined();
        // Use the existing boolean approval mode so this test does not depend on a
        // per-tool approval callback crossing the process boundary.
        await session!.state.set({ yolo: true });
        await session!.sendMessage({ content: 'Repair the broken login flow.', requestContext });
        const memory = await runtime.storage.getMastraStorage().getStore('memory');
        expect(memory).toBeDefined();
        const tasks = await runtime.storage.getMastraStorage().getStore('threadState');
        await expect
          .poll(() => tasks!.getState({ threadId: sessionId, type: 'task' }), { timeout: 15_000 })
          .toMatchObject([restartTask]);
        await expect
          .poll(async () => (await memory!.getThreadById({ threadId: sessionId }))?.title, { timeout: 15_000 })
          .toBe(title);
        // Title generation can succeed even when the main model step fails.
        await expect
          .poll(
            async () => {
              const { messages } = await memory!.listMessages({ threadId: sessionId, perPage: false });
              return JSON.stringify(messages.filter(message => message.role === 'assistant'));
            },
            { timeout: 15_000 },
          )
          .toContain('The login flow is repaired.');
      } finally {
        await worker?.stop();
        await runtime.close();
      }
    } finally {
      await pubsub.close();
      await storage.close();
      await model.stop();
      vi.unstubAllEnvs();
      rmSync(appData, { recursive: true, force: true });
    }
  },
  120_000,
);

it.skipIf(!postgresUrl || !redisUrl || !!workerPrefix).each([false, true])(
  'records an approved task in an evented Factory session (owner killed=%s)',
  async crash => {
    const model = new LLMock({ port: 0 });
    const keyPrefix = `factory-approval-${randomUUID()}`;
    const connectionString = await isolatedPostgresSchemaForTests(postgresUrl!);
    const storage = new PgFactoryStorage({ id: 'factory-test', connectionString });
    const pubsub = new RedisStreamsPubSub({ url: redisUrl!, keyPrefix });
    const appData = mkdtempSync(join(tmpdir(), 'factory-evented-approval-'));
    const stopPath = join(appData, 'worker.stop');
    const sessionId = randomUUID();
    vi.stubEnv('MASTRA_APP_DATA_DIR', appData);
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_AGENT', 'evented');
    vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
    vi.stubEnv('MASTRACODE_DISABLE_TITLE_GENERATION', '1');
    vi.stubEnv('MASTRA_WORKERS', undefined);
    vi.stubEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', '3000');
    model.on({ predicate: request => JSON.stringify(request).includes('Tasks updated:') }, { content: restartReply });
    model.onMessage(/Record the restart task/, {
      toolCalls: [{ id: approvalCallId, name: 'task_write', arguments: JSON.stringify({ tasks: [restartTask] }) }],
    });

    try {
      await model.start();
      vi.stubEnv('OPENAI_BASE_URL', `${model.url.replace(/\/+$/, '')}/v1`);
      const owner = spawnPhaseWorker(connectionString, keyPrefix, stopPath, sessionId);
      let replacement: Awaited<ReturnType<typeof bootFactory>> | undefined;
      try {
        await expect.poll(owner.output, { timeout: 45_000 }).toContain('factory-phase-approval-persisted');
        await storage.init();
        const memory = (await storage.getMastraStorage().getStore('memory'))!;
        const threadState = (await storage.getMastraStorage().getStore('threadState'))!;
        const readTasks = () => threadState.getState({ threadId: sessionId, type: 'task' });
        expect((await readTasks()) ?? []).toEqual([]);
        if (crash) {
          expect(owner.processHandle.kill('SIGKILL')).toBe(true);
          expect((await owner.closed)[1]).toBe('SIGKILL');
          const thread = (await memory.getThreadById({ threadId: sessionId }))!;
          vi.stubEnv('OPENAI_API_KEY', 'sk-phase-test');
          replacement = await bootFactory(storage, release, [publishSkill], pubsub);
          const [controller] = Object.values(replacement.mastra.listAgentControllers());
          const requestContext = phaseUserContext();
          controller!.onSessionCreated(
            async session => {
              await session.state.set({ yolo: false });
              await session.permissions.setForTool({ toolName: 'task_write', policy: 'ask' });
            },
            { blocking: true },
          );
          const session = await controller!.createSession({
            id: sessionId,
            resourceId: thread.resourceId,
            threadId: sessionId,
            ownerId: 'phase-user',
            requestContext,
          });
          expect(session.approval.isArmed({ toolCallId: approvalCallId })).toBe(false);
          expect(session.resolveToolApproval('task_write', requestContext)).toBe('ask');
          expect(await session.hasPersistedToolApproval(approvalCallId)).toBe(true);
          await session.respondToPersistedToolApproval({ toolCallId: approvalCallId, approved: true, requestContext });
        } else {
          writeFileSync(`${stopPath}.approve`, '');
          await expect.poll(owner.output, { timeout: 25_000 }).toContain('factory-phase-worker-ready');
        }
        await expect.poll(readTasks, { timeout: 15_000 }).toMatchObject([restartTask]);
        await expect
          .poll(
            async () => {
              const { messages } = await memory.listMessages({ threadId: sessionId, perPage: false });
              return JSON.stringify(messages.filter(message => message.role === 'assistant'));
            },
            { timeout: 15_000 },
          )
          .toContain(restartReply);
      } finally {
        await owner.stop();
        await replacement?.close();
      }
    } finally {
      await pubsub.close();
      await storage.close();
      await model.stop();
      vi.unstubAllEnvs();
      rmSync(appData, { recursive: true, force: true });
    }
  },
  120_000,
);

/**
 * Planning and Building run in one `builder` context, like Work's Planning and Building. The
 * planner moves the card to Building itself; Building's run must still start, in the same session.
 */
const delivery = defineBoard({
  id: 'delivery',
  name: 'Delivery',
  initialPhase: 'backlog',
  phases: {
    backlog: {
      name: 'Backlog',
      kind: 'resting',
      nextPhases: ['planning'],
    },
    planning: {
      name: 'Planning',
      kind: 'working',
      runner: { context: 'builder', skill: 'plan-feature' },
      autoStart: true,
      nextPhases: ['building'],
    },
    building: {
      name: 'Building',
      kind: 'working',
      runner: { context: 'builder', skill: 'build-feature' },
      autoStart: true,
      nextPhases: ['delivered'],
    },
    delivered: { name: 'Delivered', kind: 'terminal' },
  },
});

const deliverySkills = [
  createSkill({ name: 'plan-feature', description: 'Plan a feature', instructions: 'Plan the feature.' }),
  createSkill({ name: 'build-feature', description: 'Build a feature', instructions: 'Build the feature.' }),
];

/** Plans by reporting the outcome into Building, then builds by reporting the one into Delivered. */
function builder(): (text: string) => ToolCall | undefined {
  const moved = new Set<string>();
  return text => {
    const next = text.includes('Build the feature.')
      ? 'delivered'
      : text.includes('Plan the feature.')
        ? 'building'
        : undefined;
    if (!next || moved.has(next)) return undefined;
    moved.add(next);
    return { name: 'factory_report_outcome', args: { outcome: next, reason: `Ready for ${next}.` } };
  };
}

describe.each([
  ['dispatcher', undefined],
  ['workflow', createWorkflowBoardEngine],
] as const)('board phase fields at runtime (%s engine)', (_engine, boardEngine) => {
  it('starts a phase only for the cards its condition matches, and moves the card on the outcome the agent reports after the exit tool', async () => {
    const requests: string[] = [];
    fakeModel(requests, publisher());
    const runtime = await startFactory(release, 'build', [publishSkill], { boardEngine });
    try {
      const { project, workItems, card, read, decisionsFor } = runtime;
      const stagesOf = async (item: Card) => (await read(item)).stages;

      const quick = await card('quick fix', ['effort:low']);
      const large = await card('large rewrite', ['effort:high']);

      // The low-effort card starts on its own and its run carries the phase instructions. The
      // factory-phase signal names the exit tool and the outcomes; after the exit tool the agent
      // reports one, and Factory moves the card once the run ends.
      await vi.waitFor(async () => expect(await stagesOf(quick)).toEqual(['done']), { timeout: 15_000 });
      const publishRequest = requests.find(text => text.includes(PUBLISH) && text.includes('quick fix'));
      expect(publishRequest).toContain('Keep it short.');
      expect(publishRequest).toContain(
        'This phase ends when factory_list_work_items succeeds; until then the card stays here. Then report an outcome with factory_report_outcome.',
      );
      expect(publishRequest).toContain('Outcomes: done: Done → Done; backlog: Backlog → Backlog');

      // The high-effort card reaches Build too, but its run waits for a person: nothing ran.
      await vi.waitFor(
        async () => {
          expect(await stagesOf(large)).toEqual(['build']);
          expect((await decisionsFor(large)).map(record => [record.decision.type, record.status])).toEqual(
            expect.arrayContaining([['invokeSkill', 'proposed']]),
          );
        },
        { timeout: 15_000 },
      );
      expect(await workItems.listRunBindings(ORG, project.id, large.id)).toEqual([]);
      expect(requests.some(text => text.includes('large rewrite'))).toBe(false);
    } finally {
      await runtime.close();
    }
  }, 60_000);
  it("starts the next phase's run in the same session when the agent's reported outcome moves its own card within one context", async () => {
    const requests: string[] = [];
    fakeModel(requests, builder());
    const runtime = await startFactory(delivery, 'planning', deliverySkills, { boardEngine });
    try {
      const { project, workItems, card, read } = runtime;
      const feature = await card('the feature', []);

      await vi.waitFor(async () => expect((await read(feature)).stages).toEqual(['delivered']), { timeout: 15_000 });
      // The build prompt reached the agent after the planner's own move, in the planner's thread.
      const buildRequest = requests.find(text => text.includes('Build the feature.'));
      expect(buildRequest).toContain('Plan the feature.');
      const item = await read(feature);
      expect(Object.keys(item.sessions)).toEqual(['builder']);
      const bindings = await workItems.listRunBindings(ORG, project.id, feature.id);
      expect(new Set(bindings.map(binding => binding.sessionId)).size).toBe(1);
      expect(bindings.map(binding => binding.role)).toEqual(bindings.map(() => 'builder'));
    } finally {
      await runtime.close();
    }
  }, 60_000);

  describe('a custom phase that runs an app skill', () => {
    /** The intake route files cards into Drafting; Drafting runs only `runner.skill`. */
    const notes = defineBoard({
      id: 'notes',
      name: 'Notes',
      initialPhase: 'backlog',
      phases: {
        backlog: {
          name: 'Backlog',
          kind: 'resting',
          nextPhases: ['drafting'],
        },
        drafting: {
          name: 'Drafting',
          kind: 'working',
          runner: { context: 'writer', skill: 'release-notes' },
          autoStart: true,
          nextPhases: ['published'],
        },
        published: { name: 'Published', kind: 'terminal' },
      },
    });
    const SKILL_RULE = 'Group the release notes by package and end with a one-line summary.';

    /** Following the release-notes skill, the agent reports the outcome into Published. */
    function writer(): (text: string) => ToolCall | undefined {
      let moved = false;
      return text => {
        if (moved || !text.includes(SKILL_RULE)) return undefined;
        moved = true;
        return { name: 'factory_report_outcome', args: { outcome: 'published', reason: 'Notes drafted.' } };
      };
    }

    /** Creates a card, waits for Drafting's skill start to settle, and returns what the model received. */
    async function draftNotes(skills?: InlineSkill[]) {
      const requests: string[] = [];
      fakeModel(requests, writer());
      const runtime = await startFactory(notes, 'drafting', skills, { boardEngine });
      try {
        const item = await runtime.card('v2 notes', []);
        // Capture the start the moment it settles: a missing skill keeps retrying in the background.
        const settled = await vi.waitFor(
          async () => {
            const start = (await runtime.decisionsFor(item)).find(record => record.decision.type === 'invokeSkill');
            const stages = (await runtime.read(item)).stages;
            if (start?.status === 'succeeded') expect(stages).toEqual(['published']);
            else expect(start?.lastError).toContain('Skill not found');
            return { start: start!, stages };
          },
          { timeout: 15_000 },
        );
        return { requests, ...settled };
      } finally {
        await runtime.close();
      }
    }

    it('runs a skill passed to MastraFactory({ skills }) when a card enters the phase', async () => {
      const { requests, start, stages } = await draftNotes([
        createSkill({ name: 'release-notes', description: 'Draft release notes', instructions: SKILL_RULE }),
      ]);
      expect(start).toMatchObject({ status: 'succeeded', decision: { skillName: 'release-notes' } });
      // The model received the app skill's instructions, then reported the outcome that moved the card.
      expect(requests.find(text => text.includes(SKILL_RULE))).toContain('release-notes');
      expect(stages).toEqual(['published']);
    }, 60_000);

    describe('from the app factory-skills folder', () => {
      let appRoot: string;

      beforeEach(() => {
        appRoot = mkdtempSync(join(tmpdir(), 'factory-app-skills-'));
        mkdirSync(join(appRoot, 'factory-skills', 'release-notes'), { recursive: true });
        writeFileSync(
          join(appRoot, 'factory-skills', 'release-notes', 'SKILL.md'),
          `---\nname: release-notes\ndescription: Draft release notes\n---\n\n${SKILL_RULE}\n`,
        );
      });

      afterEach(() => rmSync(appRoot, { recursive: true, force: true }));

      it('runs a folder skill when a card enters the phase', async () => {
        vi.spyOn(process, 'cwd').mockReturnValue(appRoot);
        const { requests, start, stages } = await draftNotes();
        expect(start).toMatchObject({ status: 'succeeded', decision: { skillName: 'release-notes' } });
        expect(requests.some(text => text.includes(SKILL_RULE))).toBe(true);
        expect(stages).toEqual(['published']);
      }, 60_000);
    });

    it('starts no run, and leaves the card in the phase, when the skill does not exist', async () => {
      const { requests, start, stages } = await draftNotes();
      expect(start).toMatchObject({ status: 'retry', decision: { skillName: 'release-notes' } });
      expect(start.lastError).toContain('Skill not found: release-notes.');
      expect(requests.some(text => text.includes(SKILL_RULE))).toBe(false);
      expect(stages).toEqual(['drafting']);
    }, 60_000);
  });
});
