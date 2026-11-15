import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { FactoryStorage } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import type { FactorySandbox, FactorySandboxContext, MastraSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage, PostgresStore } from '@mastra/pg';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { boardRegistryOf, defineBoard } from '../boards/index.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createSourceControlSessionLookup } from '../session/factory-session.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { controllerRunInFlight, createContextSandboxStops, createTerminalSandboxStops } from './context-sandboxes.js';
import { LocalFactorySandbox } from './local-factory-sandbox.js';
import { SessionRetirementCoordinator } from './session-retirement.js';
import { __clearSessionSandboxesForTests, getSessionSandbox, peekSessionSandbox } from './session-sandbox.js';

afterEach(() => __clearSessionSandboxesForTests());

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const backends = postgresUrl ? (['libsql', 'pg'] as const) : (['libsql'] as const);

/** Triage runs in its own context; Planning and Building share `work`; PR review runs in `review`. */
const shipBoard = defineBoard({
  id: 'ship',
  name: 'Ship',
  initialPhase: 'intake',
  phases: {
    intake: { name: 'Intake', kind: 'resting', nextPhases: ['triage'] },
    triage: { name: 'Triage', kind: 'working', runner: { context: 'triage' }, nextPhases: ['planning', 'done'] },
    planning: { name: 'Planning', kind: 'working', runner: { context: 'work' }, nextPhases: ['execute', 'done'] },
    execute: { name: 'Building', kind: 'working', runner: { context: 'work' }, nextPhases: ['pr-review', 'done'] },
    'pr-review': {
      name: 'PR review',
      kind: 'working',
      runner: { context: 'review' },
      nextPhases: ['triage', 'done'],
    },
    done: { name: 'Done', kind: 'terminal', nextPhases: [] },
  },
});
const boards = boardRegistryOf([shipBoard]);
const CONTEXTS = ['triage', 'work', 'review'] as const;
type Context = (typeof CONTEXTS)[number];

/** Two storage instances over one database, like two Factory replicas. */
async function sharedDatabase(backend: 'libsql' | 'pg'): Promise<[FactoryStorage, FactoryStorage]> {
  if (backend === 'libsql') {
    const dir = await mkdtemp(join(tmpdir(), 'factory-ctx-'));
    onTestFinished(() => rm(dir, { recursive: true, force: true }));
    const url = `file:${join(dir, 'factory.db')}`;
    return [new LibSQLFactoryStorage({ id: 'factory-a', url }), new LibSQLFactoryStorage({ id: 'factory-b', url })];
  }
  const admin = new PostgresStore({ id: 'factory-ctx-admin', connectionString: postgresUrl!, disableInit: true });
  const schema = `factory_ctx_${randomUUID().replaceAll('-', '')}`;
  await admin.pool.query(`CREATE SCHEMA "${schema}"`);
  onTestFinished(async () => {
    await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.close();
  });
  const url = new URL(postgresUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  return [
    new PgFactoryStorage({ id: 'factory-a', connectionString: url.toString() }),
    new PgFactoryStorage({ id: 'factory-b', connectionString: url.toString() }),
  ];
}

/** A sandbox provider that records what it was asked to stop by identity. */
function recordingSandbox(calls: string[], { failStop = false } = {}): FactorySandbox {
  return {
    provider: 'recording',
    create: (ctx: FactorySandboxContext) => ({
      id: ctx.sessionId,
      stop: async () => {
        if (failStop) {
          calls.push(`stop-attempt:${ctx.sessionId}:${ctx.sandboxId}`);
          throw new Error('pause failed');
        }
        calls.push(`stop:${ctx.sessionId}:${ctx.sandboxId}`);
      },
      destroy: async () => {
        calls.push(`destroy:${ctx.sessionId}:${ctx.sandboxId}`);
      },
    }),
  } as unknown as FactorySandbox;
}

/** One Factory process: its own transition service, retirement and sandbox, over a shared database. */
async function factoryOn(
  storage: FactoryStorage,
  sandbox: FactorySandbox,
  runInFlight: (sessionId: string) => Promise<{ ended: Promise<void> } | null> = async () => null,
) {
  const seed = await createFactoryStorageForTests(storage);
  const sessions = createSourceControlSessionLookup([seed.sourceControl.forIntegration('github')]);
  const retirement = new SessionRetirementCoordinator({ sandbox, warn: () => {} });
  const service = new FactoryTransitionService({
    configVersion: 'context-sandboxes',
    boards,
    storage: seed.workItems,
    onContextLeft: createContextSandboxStops({
      workItems: seed.workItems,
      boards,
      sessions,
      retirement,
      runInFlight,
      warn: () => {},
    }),
    onTerminalStage: createTerminalSandboxStops({ workItems: seed.workItems, sessions, retirement }),
  });
  return { seed, service };
}

/** A card on the Ship board holding one session per context, each with its own repository-linked row. */
async function cardWithSessions(seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>, stage: string) {
  const orgId = `org-${randomUUID()}`;
  const github = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({ orgId, userId: 'user-1', input: { name: 'Ship' } });
  const installation = await github.installations.upsert({
    orgId,
    connectedByUserId: 'user-1',
    externalId: `install-${orgId}`,
    accountName: 'acme',
    accountType: 'organization',
  });
  const repository = await github.repositories.upsert({
    orgId,
    input: {
      installationId: installation.id,
      externalId: `repo-${orgId}`,
      slug: 'acme/ship',
      defaultBranch: 'main',
      providerMetadata: {},
    },
  });
  const connection = await github.connections.create({
    orgId,
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await github.projectRepositories.link({
    orgId,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    branch: null,
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/ship',
  });
  const rows = {} as Record<Context, SourceControlSession>;
  for (const context of CONTEXTS) {
    rows[context] = await github.sessions.create({
      sessionId: randomUUID(),
      projectRepositoryId: link.id,
      factoryProjectId: project.id,
      orgId,
      userId: 'user-1',
      branch: `factory/issue-3-${context}`,
      baseBranch: 'main',
    });
  }
  const { item } = await seed.workItems.upsert({
    orgId,
    userId: 'user-1',
    factoryProjectId: project.id,
    input: {
      board: 'ship',
      externalSource: { integrationId: 'github', type: 'issue', externalId: `issue-${orgId}` },
      title: 'Keep minimal boilerplate',
      stages: [stage],
      sessions: Object.fromEntries(
        CONTEXTS.map(context => [
          context,
          { sessionId: rows[context].sessionId, branch: rows[context].branch, threadId: `thread-${context}` },
        ]),
      ),
      metadata: {},
    },
  });
  return { orgId, factoryProjectId: project.id, item, rows, github };
}

async function move(
  service: FactoryTransitionService,
  card: { orgId: string; factoryProjectId: string; item: { id: string } },
  stage: string,
  revision: number,
) {
  return service.transition({
    orgId: card.orgId,
    factoryProjectId: card.factoryProjectId,
    workItemId: card.item.id,
    board: 'ship',
    stage,
    expectedRevision: revision,
    actor: { type: 'human', id: 'user-1' },
    ingress: { type: 'human', identity: `move-${card.item.id}-${stage}-${revision}` },
    cause: 'test',
  });
}

/** Start a session's sandbox in this process, the way a run opens it. */
async function startSandbox(local: LocalFactorySandbox, row: SourceControlSession): Promise<MastraSandbox> {
  const entry = getSessionSandbox(row.id, 'acme/ship', () =>
    local.create({ sessionId: row.id, getRepositoryAccess: undefined }),
  );
  const sandbox = entry.sandbox as unknown as MastraSandbox;
  await sandbox._start();
  return sandbox;
}

describe.each(backends)('card sandboxes as a card moves between contexts, on %s', backend => {
  async function setup(stage: string, runInFlight?: (sessionId: string) => Promise<{ ended: Promise<void> } | null>) {
    const root = await mkdtemp(join(tmpdir(), 'factory-sandboxes-'));
    onTestFinished(() => rm(root, { recursive: true, force: true }));
    const local = new LocalFactorySandbox({ root });
    const [storage] = await sharedDatabase(backend);
    const factory = await factoryOn(storage, local, runInFlight);
    const card = await cardWithSessions(factory.seed, stage);
    return { ...factory, card, local, root };
  }

  it('stops the triage sandbox when the card leaves Triage, and leaves the work sandbox running', async () => {
    const { service, card, local } = await setup('triage');
    const triage = await startSandbox(local, card.rows.triage);
    const work = await startSandbox(local, card.rows.work);

    const moved = await move(service, card, 'planning', card.item.revision);

    expect(moved).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect(triage.status).toBe('stopped');
    expect(peekSessionSandbox(card.rows.triage.id)).toBeUndefined();
    expect(work.status).toBe('running');
    expect(peekSessionSandbox(card.rows.work.id)?.sandbox).toBe(work);
  });

  it('stops nothing when the next phase runs in the same context', async () => {
    const { service, card, local } = await setup('planning');
    const triage = await startSandbox(local, card.rows.triage);
    const work = await startSandbox(local, card.rows.work);

    const moved = await move(service, card, 'execute', card.item.revision);

    expect(moved).toMatchObject({ status: 'accepted', stage: 'execute' });
    expect(work.status).toBe('running');
    expect(triage.status).toBe('running');
  });

  it('resumes the same triage sandbox, files and all, when the card comes back to Triage', async () => {
    const { service, card, local, root } = await setup('triage');
    const triage = await startSandbox(local, card.rows.triage);
    await triage.executeCommand!('sh', ['-c', 'echo kept > notes.txt']);

    const left = await move(service, card, 'planning', card.item.revision);
    expect(triage.status).toBe('stopped');
    const built = await move(service, card, 'execute', left.status === 'accepted' ? left.revision : -1);
    const reviewing = await move(service, card, 'pr-review', built.status === 'accepted' ? built.revision : -1);
    const back = await move(service, card, 'triage', reviewing.status === 'accepted' ? reviewing.revision : -1);
    expect(back).toMatchObject({ status: 'accepted', stage: 'triage' });

    const resumed = await startSandbox(local, card.rows.triage);
    expect(resumed).not.toBe(triage);
    expect(resumed.status).toBe('running');
    const read = await resumed.executeCommand!('cat', ['notes.txt']);
    expect(read.stdout.trim()).toBe('kept');
    expect(await readFile(join(root, card.rows.triage.id, 'notes.txt'), 'utf8')).toBe('kept\n');
  });

  it('waits for the run still in flight on the triage session, then stops its sandbox', async () => {
    let endRun = () => {};
    const ended = new Promise<void>(resolve => {
      endRun = resolve;
    });
    const { service, card, local } = await setup('triage', async () => ({ ended }));
    const triage = await startSandbox(local, card.rows.triage);

    const moved = await move(service, card, 'planning', card.item.revision);

    expect(moved).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect(triage.status).toBe('running');
    endRun();
    await vi.waitFor(() => expect(triage.status).toBe('stopped'));
  });

  it('keeps the triage sandbox when the card is back in Triage by the time the run ends', async () => {
    let endRun = () => {};
    const ended = new Promise<void>(resolve => {
      endRun = resolve;
    });
    const { service, card, local, seed } = await setup('triage', async () => ({ ended }));
    const triage = await startSandbox(local, card.rows.triage);
    const left = await move(service, card, 'planning', card.item.revision);
    assertAccepted(left);

    // A person puts it back in Triage before the run that moved it ends.
    await seed.workItems.update({
      orgId: card.orgId,
      id: card.item.id,
      expectedRevision: left.revision,
      patch: { stages: ['triage'] },
    });
    endRun();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(triage.status).toBe('running');
  });
});

function assertAccepted(
  result: Awaited<ReturnType<typeof move>>,
): asserts result is Extract<typeof result, { status: 'accepted' }> {
  expect(result.status).toBe('accepted');
}

describe.each(backends)('card sandboxes across Factory processes, on %s', backend => {
  it('stops every sandbox of a card finished on a process that never opened them', async () => {
    const calls: string[] = [];
    const [first, second] = await sharedDatabase(backend);
    const holder = await factoryOn(first, recordingSandbox([]));
    const card = await cardWithSessions(holder.seed, 'pr-review');
    // The process that ran the card persisted each VM's id when it started it.
    for (const context of CONTEXTS) {
      await card.github.sessions.setSandbox({
        id: card.rows[context].id,
        sandboxId: `vm-${context}`,
        sandboxWorkdir: '/home/user/ship',
      });
    }
    const other = await factoryOn(second, recordingSandbox(calls));

    const done = await move(other.service, card, 'done', card.item.revision);

    expect(done).toMatchObject({ status: 'accepted', stage: 'done' });
    expect(calls.toSorted()).toEqual(CONTEXTS.map(context => `stop:${card.rows[context].id}:vm-${context}`).toSorted());
  });

  it('still commits the move when stopping the left sandbox fails', async () => {
    const calls: string[] = [];
    const [storage] = await sharedDatabase(backend);
    const factory = await factoryOn(storage, recordingSandbox(calls, { failStop: true }));
    const card = await cardWithSessions(factory.seed, 'triage');
    await card.github.sessions.setSandbox({
      id: card.rows.triage.id,
      sandboxId: 'vm-triage',
      sandboxWorkdir: '/home/user/ship',
    });

    const moved = await move(factory.service, card, 'planning', card.item.revision);

    expect(calls).toEqual([`stop-attempt:${card.rows.triage.id}:vm-triage`]);
    expect(moved).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect((await factory.seed.workItems.get({ orgId: card.orgId, id: card.item.id }))?.stages).toEqual(['planning']);
  });
});

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A provider stream held open until `gate` settles, so the run is provably in flight. */
function textStream(gate: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Triaging.' });
      await gate;
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

/** A real controller whose agent's reply streams until `release()` is called. */
async function gatedController() {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const model = new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: textStream(gate) }) });
  const agent = new Agent({ id: 'triager', name: 'triager', instructions: 'Triage the card.', model });
  const store = new InMemoryStore();
  const mastra = new Mastra({ agents: { triager: agent }, logger: false, storage: store });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage: store,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('triager') }],
  });
  await controller.init();
  return { controller, release };
}

describe.each(backends)('a run in flight on the session the card left, on a real controller, on %s', backend => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), 'factory-sandboxes-'));
    onTestFinished(() => rm(root, { recursive: true, force: true }));
    const local = new LocalFactorySandbox({ root });
    const { controller, release } = await gatedController();
    const [storage] = await sharedDatabase(backend);
    // The same check Factory wires: the controller's session for the card's session id.
    const factory = await factoryOn(
      storage,
      local,
      controllerRunInFlight(sessionId => controller.getSession(sessionId)),
    );
    const card = await cardWithSessions(factory.seed, 'triage');
    const session = await controller.createSession({
      id: card.rows.triage.sessionId,
      resourceId: card.factoryProjectId,
      ownerId: 'user-1',
    });
    await session.thread.create();
    const triage = await startSandbox(local, card.rows.triage);
    return { ...factory, card, session, triage, release };
  }

  it('keeps the triage sandbox running until the run ends, then stops it', async () => {
    const { service, card, session, triage, release } = await setup();
    const events: string[] = [];
    session.subscribe(event => events.push(event.type));
    void session.sendMessage({ content: 'Triage this issue.' }).catch(() => {});
    await vi.waitFor(() => expect(session.stream.isActive()).toBe(true));

    const moved = await move(service, card, 'planning', card.item.revision);
    expect(moved).toMatchObject({ status: 'accepted', stage: 'planning' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(events).not.toContain('agent_end');
    expect(triage.status).toBe('running');

    release();
    await vi.waitFor(() => expect(events).toContain('agent_end'));
    await vi.waitFor(() => expect(triage.status).toBe('stopped'));
  });

  it('stops the triage sandbox at once when its session is idle', async () => {
    const { service, card, session, triage } = await setup();
    expect(session.stream.isActive()).toBe(false);

    const moved = await move(service, card, 'planning', card.item.revision);

    expect(moved).toMatchObject({ status: 'accepted', stage: 'planning' });
    expect(triage.status).toBe('stopped');
  });
});
