import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createSkill } from '@mastra/core/skills';
import type { InlineSkill } from '@mastra/core/skills';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { ABORT_AGENT_CONTROLLER_SESSION_ROUTE } from '@mastra/server/handlers/agent-controller';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FactoryBoardEngine, FactoryBoardEngineFactory } from '../board-engine/engine.js';
import { createWorkflowBoardEngine, WorkflowBoardEngine } from '../board-engine/workflow-engine.js';
import { defineBoard } from '../boards/index.js';
import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { createRunStopMarker } from '../routes/run-stop-marker.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import { factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createIsolatedFactoryPostgresForTests } from '../storage/test-utils.js';
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

function toolCallAnswer(calls: number, call: ToolCall): unknown[] {
  const item = {
    id: `fc_${calls}`,
    type: 'function_call',
    call_id: `call_${calls}`,
    name: call.name,
    arguments: JSON.stringify(call.args),
  };
  return [
    { type: 'response.created', response: { id: `resp_${calls}`, created_at: 1, model: 'phase-test' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } },
    { type: 'response.function_call_arguments.delta', item_id: item.id, output_index: 0, delta: item.arguments },
    { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed' } },
    {
      type: 'response.completed',
      response: { id: `resp_${calls}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
    },
  ];
}

function textAnswer(): unknown[] {
  const item = { id: 'msg_ack', type: 'message', role: 'assistant', content: [] };
  return [
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
  ];
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
      return sse(toolCallAnswer(calls, call));
    }
    return sse(textAnswer());
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

/** A real Factory with one linked GitHub repository, driven over HTTP. */
async function startFactory(
  board: ReturnType<typeof defineBoard>,
  landing: string,
  skills?: InlineSkill[],
  {
    evented,
    boardEngine,
  }: { evented?: { postgresUrl: string; pubsub: RedisStreamsPubSub }; boardEngine?: FactoryBoardEngineFactory } = {},
) {
  vi.stubEnv('OPENAI_API_KEY', 'sk-phase-test');
  const storage = evented
    ? await createIsolatedFactoryPostgresForTests(evented.postgresUrl)
    : new LibSQLFactoryStorage({ id: 'phase-runtime', url: ':memory:' });
  const github = new GithubIntegration({
    appId: '123',
    privateKey: 'test-key',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    slug: 'phase-test',
  });
  const factory = new MastraFactory({
    storage,
    ...(evented ? { pubsub: evented.pubsub } : {}),
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
  const close = async () => {
    await factory.shutdown();
    await mastra.shutdown();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  };
  await factory.finalize();
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
  const sourceControl = github.sourceControlStorage;
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
  return {
    project,
    workItems,
    card,
    read,
    decisionsFor,
    close,
    storage,
    mastra,
    send,
    projectRepository,
    sourceControl,
  };
}

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const redisUrl = process.env.FACTORY_TEST_REDIS_URL;

it.skipIf(!postgresUrl || !redisUrl)(
  'persists a generated title for an evented Factory session over Redis Streams',
  async () => {
    const title = 'Repair the Login Flow';
    const model = new LLMock({ port: 0 });
    const pubsub = new RedisStreamsPubSub({ url: redisUrl!, keyPrefix: `factory-title-${randomUUID()}` });
    const appData = mkdtempSync(join(tmpdir(), 'factory-evented-title-'));
    vi.stubEnv('MASTRA_APP_DATA_DIR', appData);
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
    vi.stubEnv('MASTRACODE_EXPERIMENTAL_AGENT', 'evented');
    vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
    vi.stubEnv('MASTRACODE_DISABLE_TITLE_GENERATION', '0');
    model.on({ systemMessage: 'the title must be 3 to 5 words long' }, { content: title });
    model.onMessage(/.*/, { content: 'The login flow is repaired.' });

    try {
      await model.start();
      vi.stubEnv('OPENAI_BASE_URL', `${model.url.replace(/\/+$/, '')}/v1`);
      const runtime = await startFactory(release, 'build', [publishSkill], {
        evented: { postgresUrl: postgresUrl!, pubsub },
      });
      try {
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
        await session!.sendMessage({ content: 'Repair the broken login flow.', requestContext });
        const memory = await runtime.storage.getMastraStorage().getStore('memory');
        expect(memory).toBeDefined();
        await expect
          .poll(async () => (await memory!.getThreadById({ threadId: sessionId }))?.title, {
            timeout: 15_000,
          })
          .toBe(title);
        // The title comes from finalization, so it is persisted even when the model step fails.
        // The reply only exists if the model step's Factory processors could read the live controller.
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
        await runtime.close();
      }
    } finally {
      await pubsub.close();
      await model.stop();
      vi.unstubAllEnvs();
      rmSync(appData, { recursive: true, force: true });
    }
  },
  60_000,
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

/** Delivery, with a phase a person files a card in to cancel it. */
const cancellableDelivery = defineBoard({
  id: 'cancellable-delivery',
  name: 'Cancellable delivery',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['planning'] },
    planning: {
      name: 'Planning',
      kind: 'working',
      runner: { context: 'builder', skill: 'plan-feature' },
      autoStart: true,
      nextPhases: ['building', 'cancelled'],
    },
    building: {
      name: 'Building',
      kind: 'working',
      runner: { context: 'builder', skill: 'build-feature' },
      autoStart: true,
      nextPhases: ['delivered', 'cancelled'],
    },
    delivered: { name: 'Delivered', kind: 'terminal' },
    cancelled: { name: 'Cancelled', kind: 'terminal' },
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

it("flags a card on the workflow engine when its phase's agent ends two runs without reporting an outcome", async () => {
  const requests: string[] = [];
  // The agent answers in words and never reports how the phase ended.
  fakeModel(requests, () => undefined);
  let engine: FactoryBoardEngine | undefined;
  const runtime = await startFactory(release, 'build', [publishSkill], {
    boardEngine: context => (engine = createWorkflowBoardEngine(context)),
  });
  try {
    const { card, read, decisionsFor } = runtime;
    const quick = await card('quick fix', ['effort:low']);

    // The dispatcher runs the phase once more after the first run ends with nothing reported; the
    // second such end is the card's to show a person.
    await vi.waitFor(
      async () =>
        expect(await engine!.describe!({ workItemId: quick.id })).toEqual({
          state: 'needs_attention',
          phase: 'build',
          probes: 2,
          reason: "The agent's run ended twice without reporting how the phase ended.",
        }),
      { timeout: 45_000, interval: 250 },
    );
    expect((await read(quick)).stages).toEqual(['build']);
    expect(requests.filter(text => text.includes(PUBLISH) && text.includes('quick fix')).length).toBeGreaterThanOrEqual(
      2,
    );
    await vi.waitFor(
      async () =>
        expect((await decisionsFor(quick)).map(record => [record.decision.type, record.status])).toEqual(
          expect.arrayContaining([['invokeSkill', 'failed']]),
        ),
      { timeout: 15_000 },
    );
    // Nothing ran a third time, and each run end was counted once however many told of it.
    expect(await engine!.describe!({ workItemId: quick.id })).toMatchObject({ probes: 2 });
  } finally {
    await runtime.close();
  }
}, 90_000);

it("flags a card on the workflow engine with its failure's label once every attempt at its phase errored", async () => {
  // The provider call fails every time the agent's run asks it.
  let failures = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    failures += 1;
    throw new Error('The model broke.');
  });
  let engine: FactoryBoardEngine | undefined;
  const runtime = await startFactory(release, 'build', [publishSkill], {
    boardEngine: context => (engine = createWorkflowBoardEngine(context)),
  });
  try {
    const { card, read } = runtime;
    const quick = await card('quick fix', ['effort:low']);

    await vi.waitFor(
      async () =>
        expect(await engine!.describe!({ workItemId: quick.id })).toEqual({
          state: 'needs_attention',
          phase: 'build',
          probes: 0,
          attempts: 5,
          failure: 'run_failed',
          reason: 'Agent run ended in error',
        }),
      { timeout: 60_000, interval: 250 },
    );
    expect((await read(quick)).stages).toEqual(['build']);
    expect(failures).toBeGreaterThanOrEqual(5);
  } finally {
    await runtime.close();
  }
}, 90_000);

/** Delivery, but its board refuses every move out of Planning. */
const guardedDelivery = defineBoard({
  id: 'guarded-delivery',
  name: 'Guarded delivery',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['planning'] },
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
      nextPhases: ['delivered'],
    },
    delivered: { name: 'Delivered', kind: 'terminal' },
  },
  transitionPolicy: ({ fromStage }) =>
    fromStage === 'planning' ? { type: 'reject', code: 'forbidden', reason: 'Plans wait here.' } : undefined,
});

it('flags a card on the workflow engine on its first attempt when a board rule refuses the outcome its agent reported', async () => {
  const requests: string[] = [];
  fakeModel(requests, builder());
  let engine: FactoryBoardEngine | undefined;
  const runtime = await startFactory(guardedDelivery, 'planning', deliverySkills, {
    boardEngine: context => (engine = createWorkflowBoardEngine(context)),
  });
  try {
    const { card, read, decisionsFor } = runtime;
    const feature = await card('a feature', []);

    await vi.waitFor(
      async () =>
        expect(await engine!.describe!({ workItemId: feature.id })).toEqual({
          state: 'needs_attention',
          phase: 'planning',
          probes: 0,
          attempts: 1,
          lastOutcome: 'building',
          failure: 'forbidden',
          reason: "A board rule refused the run's move: the board refused the move",
        }),
      { timeout: 45_000, interval: 250 },
    );
    expect((await read(feature)).stages).toEqual(['planning']);
    // Every retry would replay the refusal, so the phase ran once.
    expect((await decisionsFor(feature)).map(record => [record.decision.type, record.status, record.attempts])).toEqual(
      [['invokeSkill', 'failed', 1]],
    );
  } finally {
    await runtime.close();
  }
}, 90_000);

/** The engine Factory holds, deaf to run ends: as if the process that watched each run died with it. */
function deafToRunEnds(engine: WorkflowBoardEngine): FactoryBoardEngine {
  return {
    workflows: engine.workflows,
    requestMove: request => engine.requestMove(request),
    requestPlacement: placement => engine.requestPlacement(placement),
    runEnded: async () => false,
    runPaused: (binding, reason) => engine.runPaused(binding, reason),
    runFailed: (seat, failure) => engine.runFailed(seat, failure),
    runStopped: seat => engine.runStopped(seat),
    describe: card => engine.describe(card),
    submitMove: request => engine.submitMove(request),
    cardDeleted: card => engine.cardDeleted(card),
    sweep: (now, held) => engine.sweep(now, held),
  };
}

it("moves a card on the workflow engine by its agent's reported outcome once a sweep finds its run ended unseen", async () => {
  const requests: string[] = [];
  fakeModel(requests, builder());
  let held: FactoryBoardEngine | undefined;
  const runtime = await startFactory(delivery, 'planning', deliverySkills, {
    boardEngine: context => (held = deafToRunEnds(new WorkflowBoardEngine(context))),
  });
  try {
    const { card, read, decisionsFor } = runtime;
    const feature = await card('a feature', []);

    // The agent reported Building and its run ended, but no one told the card's run.
    await vi.waitFor(
      async () =>
        expect((await decisionsFor(feature)).map(record => [record.decision.type, record.status])).toEqual([
          ['invokeSkill', expect.stringMatching(/^(succeeded|failed)$/)],
        ]),
      { timeout: 45_000, interval: 250 },
    );
    expect((await read(feature)).stages).toEqual(['planning']);
    expect(await held!.describe!({ workItemId: feature.id })).toMatchObject({ state: 'running', phase: 'planning' });

    // Not due yet, the sweep leaves it be; past the running deadline, it hears the run's end.
    await held!.sweep!(Date.now(), held!);
    expect((await read(feature)).stages).toEqual(['planning']);
    await held!.sweep!(Date.now() + 7 * 3_600_000, held!);

    expect((await read(feature)).stages).toEqual(['building']);
    expect(await held!.describe!({ workItemId: feature.id })).toMatchObject({
      state: 'running',
      phase: 'building',
      lastOutcome: 'building',
    });
  } finally {
    await runtime.close();
  }
}, 90_000);

describe.each([
  ['dispatcher', undefined],
  ['workflow', createWorkflowBoardEngine],
] as const)('board phase fields at runtime (%s engine)', (engineName, boardEngine) => {
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

  it(
    engineName === 'workflow'
      ? "stops the phase's run when a person moves its card on, and commits the move"
      : "refuses a person's move of a card whose phase's run is going",
    async () => {
      // Planning's model call never answers: it ends only when the run is aborted.
      let planning = 0;
      let aborted = 0;
      let built = false;
      const release = new Set<() => void>();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
        const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
        const text = JSON.stringify(JSON.parse(body).input);
        if (text.includes('Build the feature.')) {
          if (built) return sse(textAnswer());
          built = true;
          return sse(
            toolCallAnswer(1, { name: 'factory_report_outcome', args: { outcome: 'delivered', reason: 'Built.' } }),
          );
        }
        planning += 1;
        const signal = input instanceof Request ? input.signal : init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          const abort = () => {
            aborted += 1;
            reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
          };
          if (signal?.aborted) abort();
          else signal?.addEventListener('abort', abort, { once: true });
          release.add(() => reject(new Error('The test ended.')));
        });
      });
      const runtime = await startFactory(delivery, 'planning', deliverySkills, { boardEngine });
      try {
        const { project, card, read, send } = runtime;
        const feature = await card('the feature', []);
        await vi.waitFor(() => expect(planning).toBeGreaterThan(0), { timeout: 15_000 });

        // The board's feed, where a move answered 202 is told to have landed.
        const feed = await send('GET', `/web/factory/projects/${project.id}/feed-events`);
        let heard = '';
        const reader = feed.body!.getReader();
        release.add(() => void reader.cancel().catch(() => undefined));
        void (async () => {
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
            if (done) return;
            heard += decoder.decode(value, { stream: true });
          }
        })();
        await vi.waitFor(() => expect(heard).toContain(': ping'));

        const drag = await send('POST', `/web/factory/projects/${project.id}/work-items/${feature.id}/transition`, {
          board: 'delivery',
          stage: 'building',
          expectedRevision: (await read(feature)).revision,
          requestId: randomUUID(),
          cause: 'A person dragged the card',
        });
        const answer = await drag.json();

        if (engineName === 'dispatcher') {
          expect(drag.status, JSON.stringify(answer)).toBe(422);
          expect(answer.result).toMatchObject({ status: 'rejected', code: 'card_busy' });
          expect((await read(feature)).stages).toEqual(['planning']);
          expect(aborted).toBe(0);
          return;
        }
        // The move is taken on at once, and lands once the run it stopped has ended.
        expect(drag.status, JSON.stringify(answer)).toBe(202);
        expect(answer).toEqual({ inputId: expect.any(String) });
        await vi.waitFor(
          () => expect(heard).toContain(`data: ${JSON.stringify({ inputId: answer.inputId, status: 'accepted' })}`),
          { timeout: 15_000 },
        );
        expect(aborted).toBeGreaterThan(0);
        // Building's run starts after the stopped one and ends the card's work; the stopped
        // Planning run wasn't run again, and the card entered Building once.
        await vi.waitFor(async () => expect((await read(feature)).stages).toEqual(['delivered']), { timeout: 15_000 });
        const history = (await read(feature)).stageHistory.map(entry => entry.stage);
        expect(history.filter(stage => stage === 'building')).toHaveLength(1);
        expect(history.filter(stage => stage === 'planning')).toHaveLength(1);
        expect(planning).toBe(1);
      } finally {
        for (const end of release) end();
        await runtime.close();
      }
    },
    60_000,
  );

  it.runIf(engineName === 'workflow')(
    "refuses a person's move as busy, stopping nothing, when the phase's run is in another person's private session",
    async () => {
      let planning = 0;
      let aborted = 0;
      const release = new Set<() => void>();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
        planning += 1;
        const signal = input instanceof Request ? input.signal : init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => (aborted += 1), { once: true });
          release.add(() => reject(new Error('The test ended.')));
        });
      });
      const runtime = await startFactory(delivery, 'planning', deliverySkills, { boardEngine });
      try {
        const { project, card, read, send, workItems, sourceControl } = runtime;
        const feature = await card('the private feature', []);
        await vi.waitFor(() => expect(planning).toBeGreaterThan(0), { timeout: 15_000 });
        // The run's session is someone else's, and private: the person dragging may not drive it.
        const [seat] = (await workItems.listRunBindings(ORG, project.id, feature.id)).filter(
          binding => binding.status === 'active',
        );
        const session = (await sourceControl.sessions.getBySessionId(seat!.sessionId))!;
        await sourceControl.sessions.transferOwner({
          sessionId: session.sessionId,
          expectedUserId: session.userId,
          toUserId: 'someone-else',
        });
        const hidden = await sourceControl.sessions.setVisibility({
          sessionId: session.sessionId,
          visibility: 'private',
          expectedUserId: 'someone-else',
        });
        expect(hidden).toMatchObject({ userId: 'someone-else', visibility: 'private' });

        // The board's feed: the engine takes the move on, and tells there that it was refused.
        const feed = await send('GET', `/web/factory/projects/${project.id}/feed-events`);
        let heard = '';
        const reader = feed.body!.getReader();
        release.add(() => void reader.cancel().catch(() => undefined));
        void (async () => {
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
            if (done) return;
            heard += decoder.decode(value, { stream: true });
          }
        })();
        await vi.waitFor(() => expect(heard).toContain(': ping'));

        const drag = await send('POST', `/web/factory/projects/${project.id}/work-items/${feature.id}/transition`, {
          board: 'delivery',
          stage: 'building',
          expectedRevision: (await read(feature)).revision,
          requestId: randomUUID(),
          cause: 'A person dragged the card',
        });
        const answer = await drag.json();

        expect(drag.status, JSON.stringify(answer)).toBe(202);
        await vi.waitFor(() => expect(heard).toContain(`"inputId":"${answer.inputId}"`));
        expect(heard).toContain('"status":"rejected","code":"card_busy"');
        expect((await read(feature)).stages).toEqual(['planning']);
        expect(aborted).toBe(0);
        expect((await workItems.listRunBindings(ORG, project.id, feature.id))[0]?.stopRequestedAt ?? null).toBeNull();
      } finally {
        for (const end of release) end();
        await runtime.close();
      }
    },
    60_000,
  );

  /** Planning's model calls never answer: each ends only when its run is aborted. */
  /** A person's Stop of the card's session, as Factory's host serves it: the stop is marked, then the session aborts. */
  async function stopSession(
    { project, workItems, mastra }: Awaited<ReturnType<typeof startFactory>>,
    engine: () => FactoryBoardEngine,
    workItemId: string,
  ) {
    const host = new Hono();
    host.use(
      '*',
      createRunStopMarker({
        auth: { enabled: () => true, ensureUser: async () => undefined, tenant: () => ({ orgId: ORG }) },
        workItems: () => workItems,
        boardEngine: engine,
        runInFlight: async sessionId =>
          (await mastra.getAgentController('code')?.getSession(sessionId))?.stream.isActive() ?? false,
      }),
    );
    host.post(`/api${ABORT_AGENT_CONTROLLER_SESSION_ROUTE.path}`, async c => {
      const controller = mastra.getAgentController(c.req.param('controllerId') ?? '');
      (await controller?.getSession(c.req.param('sessionId') ?? ''))?.abort();
      return c.json({ ok: true });
    });
    const [seat] = (await workItems.listRunBindings(ORG, project.id, workItemId)).filter(
      binding => binding.status === 'active',
    );
    return host.request(`/api/agent-controller/code/sessions/${seat!.sessionId}/abort`, { method: 'POST' });
  }

  function blockingPlanner({ failFirst = false } = {}) {
    const state = { planning: 0, aborted: 0, release: new Set<() => void>() };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
      state.planning += 1;
      if (failFirst && state.planning === 1) throw new Error('The model broke.');
      const signal = input instanceof Request ? input.signal : init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => {
          state.aborted += 1;
          reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        state.release.add(() => reject(new Error('The test ended.')));
      });
    });
    return state;
  }

  it.runIf(engineName === 'workflow')(
    'leaves a card a person stopped in its phase, needing attention, until someone starts it again',
    async () => {
      const model = blockingPlanner();
      let engine!: FactoryBoardEngine;
      const runtime = await startFactory(delivery, 'planning', deliverySkills, {
        boardEngine: context => (engine = createWorkflowBoardEngine(context)),
      });
      try {
        const { project, card, read, send, workItems, mastra } = runtime;
        const feature = await card('the stopped feature', []);
        await vi.waitFor(() => expect(model.planning).toBe(1), { timeout: 15_000 });
        await vi.waitFor(async () =>
          expect(await engine.describe!({ workItemId: feature.id })).toMatchObject({
            state: 'running',
            phase: 'planning',
          }),
        );

        const stop = await stopSession(runtime, () => engine, feature.id);
        expect(stop.status).toBe(200);
        expect(model.aborted).toBe(1);
        await vi.waitFor(async () =>
          expect(await engine.describe!({ workItemId: feature.id })).toEqual({
            state: 'needs_attention',
            phase: 'planning',
            probes: 0,
            reason: 'Stopped by a person.',
          }),
        );
        // The card's details show the same, as the board reads them.
        const shown = await send(
          'GET',
          `/web/factory/projects/${project.id}/work-items/${feature.id}/run-state`,
          undefined,
        );
        expect(await shown.json()).toEqual({ runState: await engine.describe!({ workItemId: feature.id }) });
        expect((await read(feature)).stages).toEqual(['planning']);
        // The stopped run isn't run again.
        await new Promise(resolve => setTimeout(resolve, 1_500));
        expect(model.planning).toBe(1);
        const recorded = JSON.stringify(
          await mastra.getWorkflow('factory-board').getWorkflowRunById(`factory-board:${feature.id}`),
        );
        expect(recorded).not.toContain('phase-user');
        expect(recorded).not.toContain(ORG);

        // Start, from the card: the phase is entered again, and its run starts.
        const start = await send('POST', `/web/factory/projects/${project.id}/work-items/${feature.id}/transition`, {
          board: 'delivery',
          stage: 'planning',
          reenter: true,
          expectedRevision: (await read(feature)).revision,
          requestId: randomUUID(),
          cause: 'card_action',
        });
        expect([200, 202], await start.text()).toContain(start.status);
        await vi.waitFor(() => expect(model.planning).toBe(2), { timeout: 15_000 });
        expect(await engine.describe!({ workItemId: feature.id })).toMatchObject({
          state: 'running',
          phase: 'planning',
        });
      } finally {
        for (const end of model.release) end();
        await runtime.close();
      }
    },
    60_000,
  );

  it.runIf(engineName === 'workflow')(
    "leaves a card running when a person's Stop finds its run waiting out a retry, and the retry runs",
    async () => {
      const model = blockingPlanner({ failFirst: true });
      let engine!: FactoryBoardEngine;
      const runtime = await startFactory(delivery, 'planning', deliverySkills, {
        boardEngine: context => (engine = createWorkflowBoardEngine(context)),
      });
      try {
        const feature = await runtime.card('the feature stopped between attempts', []);
        await vi.waitFor(
          async () =>
            expect(await engine.describe!({ workItemId: feature.id })).toMatchObject({
              state: 'running',
              attempts: 1,
            }),
          { timeout: 15_000 },
        );
        expect(model.planning).toBe(1);

        const stop = await stopSession(runtime, () => engine, feature.id);
        expect(stop.status).toBe(200);
        await vi.waitFor(() => expect(model.planning).toBe(2), { timeout: 15_000 });
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(await engine.describe!({ workItemId: feature.id })).toMatchObject({
          state: 'running',
          phase: 'planning',
        });
      } finally {
        for (const end of model.release) end();
        await runtime.close();
      }
    },
    60_000,
  );

  it.runIf(engineName === 'workflow')(
    "stops the phase's run when a person cancels its card, and commits the cancel",
    async () => {
      const model = blockingPlanner();
      let engine!: FactoryBoardEngine;
      const runtime = await startFactory(cancellableDelivery, 'planning', deliverySkills, {
        boardEngine: context => (engine = createWorkflowBoardEngine(context)),
      });
      try {
        const { project, card, read, send } = runtime;
        const feature = await card('the cancelled feature', []);
        await vi.waitFor(() => expect(model.planning).toBe(1), { timeout: 15_000 });

        const cancel = await send('POST', `/web/factory/projects/${project.id}/work-items/${feature.id}/transition`, {
          board: 'cancellable-delivery',
          stage: 'cancelled',
          expectedRevision: (await read(feature)).revision,
          requestId: randomUUID(),
          cause: 'A person cancelled the card',
        });
        expect([200, 202], await cancel.text()).toContain(cancel.status);
        await vi.waitFor(async () => expect((await read(feature)).stages).toEqual(['cancelled']), { timeout: 15_000 });
        expect(model.aborted).toBe(1);
        expect(await engine.describe!({ workItemId: feature.id })).toMatchObject({
          state: 'terminal',
          phase: 'cancelled',
        });
        // Planning's run isn't run again; the session only hears that the card was moved.
        await new Promise(resolve => setTimeout(resolve, 1_500));
        expect(
          (await runtime.decisionsFor(feature))
            .filter(record => record.decision.type === 'invokeSkill')
            .map(record => record.status),
        ).toEqual(['superseded']);
      } finally {
        for (const end of model.release) end();
        await runtime.close();
      }
    },
    60_000,
  );

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
