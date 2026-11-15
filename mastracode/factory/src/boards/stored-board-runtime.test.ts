import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Mastra } from '@mastra/core/mastra';
import type { FactoryStorage } from '@mastra/core/storage';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage, PostgresStore } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from '../factory.js';
import { resolveGithubRules } from '../integrations/github/default-rules.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { GithubRules } from '../integrations/github/rules.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { FactoryDecisionDispatcher } from '../rules/dispatcher.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { StoredBoardInput, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { IntegrationStorage } from '../storage/domains/integrations/base.js';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import { factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { compileBoardDefinition } from './define-board.js';
import { ProjectBoardCache } from './project-boards.js';
import { createBoardRegistry } from './registry.js';
import type { InstalledBoard } from './registry.js';
import { boardDefinitionOf } from './stored-board.js';
import { workSeedWithTriage } from './work-seeds.js';
import { workBoard } from './work.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

class TestSandbox extends MastraSandbox {
  readonly id = randomUUID();
  readonly name = 'Stored boards test sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'Stored boards test sandbox' });
  }

  async executeCommand(command: string) {
    return { exitCode: 0, stdout: command === 'pwd' ? '/home/test\n' : '', stderr: '' };
  }
}

type ToolCall = { name: string; args: Record<string, unknown> };

function sse(events: { type: string }[]): Response {
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

/**
 * The model, at the wire: each request body is kept, and every run gets a short text answer
 * unless `decide` picks a tool call for what the request says.
 */
function stubModel(decide: (input: string) => ToolCall | undefined = () => undefined) {
  vi.stubEnv('OPENAI_API_KEY', 'sk-stored-boards-test');
  const requests: string[] = [];
  let calls = 0;
  onTestFinished(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
    requests.push(body);
    const call = decide(JSON.stringify(JSON.parse(body).input));
    if (call) {
      calls += 1;
      const tool = {
        id: `fc_${calls}`,
        type: 'function_call',
        call_id: `call_${calls}`,
        name: call.name,
        arguments: JSON.stringify(call.args),
      };
      return sse([
        { type: 'response.created', response: { id: `resp_${calls}`, created_at: 1, model: 'stored-test' } },
        { type: 'response.output_item.added', output_index: 0, item: { ...tool, arguments: '' } },
        { type: 'response.function_call_arguments.delta', item_id: tool.id, output_index: 0, delta: tool.arguments },
        { type: 'response.output_item.done', output_index: 0, item: { ...tool, status: 'completed' } },
        {
          type: 'response.completed',
          response: { id: `resp_${calls}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
        },
      ] as { type: string }[]);
    }
    const item = { id: 'msg_stored', type: 'message', role: 'assistant', content: [] };
    const events = [
      { type: 'response.created', response: { id: 'resp_stored', created_at: 1, model: 'stored-test' } },
      { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'Noted.' },
      { type: 'response.output_item.done', output_index: 0, item },
      {
        type: 'response.completed',
        response: {
          id: 'resp_stored',
          status: 'completed',
          incomplete_details: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      },
    ];
    return sse(events);
  });
  return requests;
}

/** A board an admin added to a project; it lives only in that project's database. */
/**
 * The `ourWorkBoard` a document shows for replacing Work, run as written (its one type annotation
 * dropped), so the documented migration keeps passing `upsertBoard`'s checks.
 */
function documentedWorkBoard(path: string): StoredBoardInput {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const code = /\nconst work = workSeedWithTriage\(\);\n[\s\S]*?\n\};\n/.exec(text)?.[0];
  if (!code) throw new Error(`${path} shows no ourWorkBoard built from workSeedWithTriage().`);
  const run = new Function(
    'workSeedWithTriage',
    `${code.replace('const ourWorkBoard: StoredBoardInput =', 'const ourWorkBoard =')}\nreturn ourWorkBoard;`,
  );
  return run(workSeedWithTriage) as StoredBoardInput;
}

const bugsBoard: StoredBoardInput = {
  key: 'bugs',
  name: 'Bugs',
  phases: [
    { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixing', 'wontfix'] },
    { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' }, nextPhases: ['fixed'] },
    { key: 'fixed', name: 'Fixed', kind: 'terminal' },
    { key: 'wontfix', name: "Won't fix", kind: 'terminal' },
  ],
};

/** An app board with a pull request review phase, for a project that has no Work. */
const opsBoard: StoredBoardInput = {
  key: 'ops',
  name: 'Ops',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting', nextPhases: ['fix', 'review', 'closed'] },
    { key: 'fix', name: 'Fix', kind: 'working', runner: { context: 'work' }, nextPhases: ['review', 'closed'] },
    {
      key: 'review',
      name: 'Review',
      kind: 'working',
      runner: { context: 'review', skill: 'factory-review' },
      tools: ['factory_review_source', 'factory_record_review_verdict'],
      nextPhases: ['fix', 'inbox', 'closed'],
    },
    { key: 'closed', name: 'Closed', kind: 'terminal' },
  ],
};

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'an admin added a stored board to a project (%s)',
  backend => {
    function database() {
      if (backend === 'postgres')
        return () => new PgFactoryStorage({ id: `stored-${randomUUID()}`, connectionString: postgresUrl! });
      const dir = mkdtempSync(join(tmpdir(), 'factory-stored-runtime-'));
      onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
      const url = `file:${join(dir, 'factory.db')}`;
      return () => new LibSQLFactoryStorage({ id: `stored-${randomUUID()}`, url });
    }

    /**
     * A database no other test file shares: `upsertBoard({ projects: 'all' })` writes to every
     * project in it.
     */
    async function isolatedDatabase() {
      if (backend === 'libsql') return database();
      const admin = new PostgresStore({ id: `stored-admin-${randomUUID()}`, connectionString: postgresUrl! });
      const schema = `stored_runtime_${randomUUID().replaceAll('-', '')}`;
      await admin.pool.query(`CREATE SCHEMA "${schema}"`);
      onTestFinished(async () => {
        await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.close();
      });
      const url = new URL(postgresUrl!);
      url.searchParams.set('options', `-c search_path=${schema}`);
      return () => new PgFactoryStorage({ id: `stored-${randomUUID()}`, connectionString: url.toString() });
    }

    /** Boots one replica: a real `MastraFactory` with its API mounted on Hono. */
    async function boot(newStorage: () => FactoryStorage, orgId: string, options: { boards?: InstalledBoard[] } = {}) {
      const storage = newStorage();
      const github = new GithubIntegration({
        appId: '123',
        privateKey: 'test-key',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        slug: 'stored-boards-test',
      });
      const factory = new MastraFactory({
        storage,
        auth: null,
        integrations: [github],
        sandbox: () => new TestSandbox(),
        stateSecret: 'stored-boards-runtime-test-state-secret',
        secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
        ...options,
      });
      const args = await factory.prepare();
      const mastra = new Mastra(args);
      await factory.finalize();
      onTestFinished(async () => {
        await factory.shutdown();
        await mastra.stopWorkers();
        await storage.close();
      });
      const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser', { workosId: 'admin-user', organizationId: orgId });
        await next();
      });
      mountApiRoutes(app, args.server?.apiRoutes ?? []);
      const send = async (method: string, path: string, body?: unknown) => {
        const response = await app.request(path, {
          method,
          headers: { 'content-type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        return { status: response.status, json: (text ? JSON.parse(text) : null) as any };
      };
      return {
        factory,
        storage,
        github,
        send,
        boards: storage.getDomain<StoredBoardsStorage>('boards'),
        workItems: storage.getDomain<WorkItemsStorage>('work-items'),
      };
    }

    async function createProject(replica: Awaited<ReturnType<typeof boot>>, name: string) {
      const created = await replica.send('POST', '/web/factory/projects', { name });
      expect(created.status).toBe(201);
      return created.json.project.id as string;
    }

    /**
     * A project created before new projects' Work dropped Triage. It is stored without the creation
     * route, so its first board load stores Work with Triage, as Factory did for every project then.
     */
    async function createOlderProject(replica: Awaited<ReturnType<typeof boot>>, orgId: string, name: string) {
      const project = await replica.storage
        .getDomain<FactoryProjectsStorage>('projects')
        .create({ orgId, userId: 'admin-user', input: { name } });
      await catalog(replica, project.id);
      return project.id;
    }

    /** The admin's create, written straight to storage the way the boards API writes it. */
    async function addBugs(replica: Awaited<ReturnType<typeof boot>>, orgId: string, projectId: string) {
      await replica.boards.create({ orgId, factoryProjectId: projectId }, bugsBoard, 'admin-user');
    }

    async function catalog(replica: Awaited<ReturnType<typeof boot>>, projectId: string) {
      const response = await replica.send('GET', `/web/factory/projects/${projectId}/boards`);
      expect(response.status).toBe(200);
      return response.json.boards as {
        id: string;
        source?: string;
        editable?: boolean;
        phases: { id: string; name: string }[];
      }[];
    }

    function transition(
      replica: Awaited<ReturnType<typeof boot>>,
      projectId: string,
      card: { id: string; revision: number },
      stage: string,
    ) {
      return replica.send('POST', `/web/factory/projects/${projectId}/work-items/${card.id}/transition`, {
        board: 'bugs',
        stage,
        expectedRevision: card.revision,
        requestId: randomUUID(),
        cause: 'stored-board-test',
      });
    }

    it('lists the stored board next to the code boards and moves cards through its phases', async () => {
      stubModel();
      const orgId = `org-${randomUUID()}`;
      const replica = await boot(database(), orgId);
      const projectId = await createProject(replica, 'Bugs project');
      const otherProjectId = await createProject(replica, 'Other project');

      await addBugs(replica, orgId, projectId);

      // Written behind the cache's back, so the board arrives within the recheck window.
      await vi.waitFor(
        async () => expect((await catalog(replica, projectId)).map(board => board.id)).toContain('bugs'),
        {
          timeout: 5_000,
        },
      );
      const boards = await catalog(replica, projectId);
      expect(boards.map(board => [board.id, board.source, board.editable])).toEqual([
        ['work', 'builtin', true],
        ['bugs', 'stored', true],
      ]);
      const work = boards.find(board => board.id === 'work')!;
      // A project created now gets Work without Triage.
      expect(work.phases.map(phase => `${phase.id}:${phase.name}`)).toEqual([
        'intake:Intake',
        'planning:Planning',
        'execute:Building',
        'pr-review:Review',
        'done:Done',
        'canceled:Canceled',
      ]);

      const created = await replica.send('POST', `/web/factory/projects/${projectId}/work-items`, {
        board: 'bugs',
        title: 'Login button does nothing',
      });
      expect(created.status).toBe(200);
      const card = created.json.workItem as { id: string; revision: number; stages: string[] };
      expect(card.stages).toEqual(['reported']);
      const listed = await replica.send('GET', `/web/factory/projects/${projectId}/work-items`);
      expect(listed.status).toBe(200);
      expect(listed.json.workItems).toEqual([
        expect.objectContaining({
          id: card.id,
          board: 'bugs',
          stages: ['reported'],
          workItem: expect.objectContaining({ provider: 'factory', title: 'Login button does nothing' }),
        }),
      ]);

      const skipped = await transition(replica, projectId, card, 'fixed');
      expect(skipped.json.result).toMatchObject({ status: 'rejected' });
      const undeclared = await transition(replica, projectId, card, 'review');
      expect(undeclared.json.result).toMatchObject({ status: 'rejected' });
      expect(await replica.workItems.get({ orgId, id: card.id })).toMatchObject({ stages: ['reported'] });

      const fixing = await transition(replica, projectId, card, 'fixing');
      expect(fixing.json.result).toMatchObject({ status: 'accepted', stage: 'fixing' });
      const fixed = await transition(replica, projectId, { id: card.id, revision: card.revision + 1 }, 'fixed');
      expect(fixed.json.result).toMatchObject({ status: 'accepted', stage: 'fixed' });

      expect((await catalog(replica, otherProjectId)).map(board => board.id)).toEqual(['work']);
      const elsewhere = await replica.send('POST', `/web/factory/projects/${otherProjectId}/work-items`, {
        board: 'bugs',
        title: 'Not here',
      });
      expect(elsewhere.status).not.toBe(200);
    }, 30_000);

    it("treats a card in a stored board's terminal phase as finished as soon as a restarted replica is up", async () => {
      stubModel();
      const orgId = `org-${randomUUID()}`;
      const newStorage = database();
      const first = await boot(newStorage, orgId);
      const projectId = await createProject(first, 'Restarted project');
      await addBugs(first, orgId, projectId);
      const { item: card, binding } = await first.workItems.prepareRunStart({
        orgId,
        userId: 'admin-user',
        factoryProjectId: projectId,
        workItem: {
          input: {
            board: 'bugs',
            title: 'Close me',
            stages: ['reported'],
            externalSource: { integrationId: 'github', type: 'issue', externalId: `issue-${randomUUID()}` },
          },
        },
        role: 'work',
        session: {
          sessionId: `session-${randomUUID()}`,
          branch: 'factory/close-me',
          threadId: `thread-${randomUUID()}`,
        },
        resourceId: 'resource-1',
        kickoffKey: `kickoff-${randomUUID()}`,
        kickoffMessage: null,
      });

      // A replica that just booted, moving the card the way a reconciler does: straight through storage,
      // with no request having loaded the project first.
      const restarted = await boot(newStorage, orgId);
      const moved = await restarted.workItems.update({
        orgId,
        id: card.id,
        userId: 'admin-user',
        patch: { stages: ['wontfix'] },
      });
      expect(moved?.item.stages).toEqual(['wontfix']);

      // The binding is young, so only a finished card makes the sweep revoke it.
      await restarted.workItems.revokeStaleRunBindings({ olderThan: new Date(0), now: new Date() });
      expect((await restarted.workItems.listActiveRunBindings()).map(active => active.id)).not.toContain(binding.id);
    }, 30_000);

    it("reviews a pull request card in the Work board's PR review phase, as the project's boards serve it", async () => {
      stubModel();
      const orgId = `org-${randomUUID()}`;
      const replica = await boot(database(), orgId);
      const projectId = await createProject(replica, 'Pull requests project');
      // A stored board beside the code boards, so the project's boards come from code and its database.
      await addBugs(replica, orgId, projectId);
      await vi.waitFor(
        async () => expect((await catalog(replica, projectId)).map(board => board.id)).toContain('bugs'),
        {
          timeout: 5_000,
        },
      );

      const { item: card } = await replica.workItems.upsert({
        orgId,
        userId: 'admin-user',
        factoryProjectId: projectId,
        input: {
          board: 'work',
          title: 'Add rate limiting',
          externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:42' },
          metadata: { authorTrusted: true, headBranch: 'rate-limiting' },
        },
      });
      expect(card.stages).toEqual(['intake']);

      const reviewing = await replica.send(
        'POST',
        `/web/factory/projects/${projectId}/work-items/${card.id}/transition`,
        {
          board: 'work',
          stage: 'pr-review',
          expectedRevision: card.revision,
          requestId: randomUUID(),
          cause: 'card_action',
        },
      );
      expect(reviewing.json.result).toMatchObject({ status: 'accepted', stage: 'pr-review' });
      const decisions = await replica.workItems.listDeferredDecisions(orgId, projectId, { workItemId: card.id });
      expect(decisions.map(record => record.decision)).toContainEqual(
        expect.objectContaining({ type: 'invokeSkill', role: 'review', skillName: 'factory-review' }),
      );

      const building = await replica.send(
        'POST',
        `/web/factory/projects/${projectId}/work-items/${card.id}/transition`,
        {
          board: 'work',
          stage: 'execute',
          expectedRevision: card.revision + 1,
          requestId: randomUUID(),
          cause: 'card_action',
        },
      );
      expect(building.json.result).toMatchObject({ status: 'rejected', code: 'invalid_transition' });
    }, 30_000);

    describe('editing the built-in Work board', () => {
      const TRIAGE_NOTE = 'Shipyard: check the changelog.';
      const NEW_DEFAULT = 'A later release: triage by the new default.';
      const PLAN_NOTE = 'Shipyard: keep plans short.';
      const EFFORT_LOW = {
        operator: 'AND',
        conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
      };

      /**
       * The agent, answering only what was just asked of it (the messages after its last turn):
       * started on the plan skill with Shipyard's instructions, it submits a plan; once the plan
       * is approved, it moves the card to Building. Anything else gets a text answer, which ends
       * the run.
       */
      function shipyardAgent(input: string): ToolCall | undefined {
        const items = JSON.parse(input) as { type?: string; role?: string; output?: string }[];
        const lastTurn = items.findLastIndex(
          item => item.type?.startsWith('function_call') || item.role === 'assistant',
        );
        const asked = JSON.stringify(items.slice(lastTurn + 1));
        if (asked.includes('<skill name=\\"factory-plan\\">') && asked.includes(PLAN_NOTE)) {
          return { name: 'submit_plan', args: { path: '.mastracode/plans/plan.md' } };
        }
        if (items[lastTurn]?.type === 'function_call_output' && items[lastTurn].output?.includes('Plan approved.')) {
          const revision = Number([...input.matchAll(/expectedRevision (\d+)/g)].at(-1)?.[1]);
          return {
            name: 'factory_transition_work_item',
            args: { stage: 'execute', expectedRevision: revision, rationale: 'Plan approved.' },
          };
        }
        return undefined;
      }

      /**
       * A board rule moving the card, the way the dispatcher applies one: a system move carries
       * no person's consent, so only the target phase's start rule decides whether its run starts.
       * (A person's or an agent's move pre-approves the runs it queues.)
       */
      async function ruleMoves(
        replica: Awaited<ReturnType<typeof boot>>,
        orgId: string,
        projectId: string,
        card: { id: string },
        stage: string,
      ) {
        const current = (await replica.workItems.get({ orgId, id: card.id }))!;
        const identity = `shipyard-rule:${randomUUID()}`;
        const commit = await replica.workItems.commitRuleEvaluation({
          orgId,
          factoryProjectId: projectId,
          workItemId: card.id,
          ingress: { identity, triggerType: 'test' },
          configVersion: 'factory-config-v1',
          expectedRevision: current.revision,
          actor: { type: 'system', id: 'rules' },
          outcome: { status: 'accepted' },
          decisions: [{ type: 'transition', idempotencyKey: `${identity}:move`, board: 'work', stage }],
          causalChain: [],
          now: new Date(),
        });
        expect(commit.status).toBe('committed');
      }

      /** A project whose runs can start: a model, its credential, and a linked GitHub repository. */
      async function runnableProject(
        replica: Awaited<ReturnType<typeof boot>>,
        orgId: string,
        { created = false } = {},
      ) {
        // Shipyard's project predates Work without Triage, and most tests here run its Triage.
        const projectId = created
          ? await createProject(replica, 'Onboarded')
          : await createOlderProject(replica, orgId, 'Shipyard');
        const configured = await replica.send('PATCH', `/web/factory/projects/${projectId}`, {
          defaultModelId: 'openai/gpt-5.6-sol',
        });
        expect(configured.status).toBe(200);
        await replica.storage
          .getDomain<ModelCredentialsStorage>('model-credentials')
          .setCredential({ orgId }, 'openai', { type: 'api_key', key: 'sk-stored-boards-test' });
        // The stubbed model answers only OpenAI; keep observational memory from calling its observer model.
        await replica.storage.getDomain<MemorySettingsStorage>('memory-settings').patch({
          orgId,
          userId: factoryProjectSettingsUserId(projectId),
          patch: { observationThreshold: 1_000_000 },
        });
        const sourceControl = replica.github.sourceControlStorage;
        const installation = await sourceControl.installations.upsert({
          orgId,
          connectedByUserId: 'admin-user',
          externalId: randomUUID(),
        });
        const repository = await sourceControl.repositories.upsert({
          orgId,
          input: {
            installationId: installation.id,
            externalId: randomUUID(),
            slug: 'acme/shipyard',
            defaultBranch: 'main',
          },
        });
        const connection = await sourceControl.connections.create({
          orgId,
          factoryProjectId: projectId,
          installationId: installation.id,
          createdByUserId: 'admin-user',
        });
        await sourceControl.projectRepositories.link({
          orgId,
          connectionId: connection.id,
          repositoryId: repository.id,
          createdByUserId: 'admin-user',
          sandboxProvider: 'local',
          sandboxWorkdir: '/tmp/shipyard',
        });
        return projectId;
      }

      type StoredPhase = StoredBoardInput['phases'][number];

      /** Reads the project's Work board (copying it in on first read) and saves `edit` of its phases. */
      async function editWork(
        replica: Awaited<ReturnType<typeof boot>>,
        projectId: string,
        edit: (phase: StoredPhase) => StoredPhase,
      ) {
        const read = await replica.send('GET', `/web/factory/projects/${projectId}/boards/work`);
        expect(read.status).toBe(200);
        const work = read.json.board as { name: string; phases: StoredPhase[]; revision: number };
        const saved = await replica.send('PATCH', `/web/factory/projects/${projectId}/boards/work`, {
          name: work.name,
          phases: work.phases.map(edit),
          expectedRevision: work.revision,
        });
        expect(saved.status, JSON.stringify(saved.json)).toBe(200);
        return saved.json.board as { revision: number };
      }

      /** Shipyard's configuration: what it sets on Work, then its intake route for trusted issues. */
      async function configureShipyard(replica: Awaited<ReturnType<typeof boot>>, projectId: string) {
        const board = await editWork(replica, projectId, phase => {
          switch (phase.key) {
            case 'triage':
              return { ...phase, autoStart: true, runner: { ...phase.runner, instructions: TRIAGE_NOTE } };
            case 'planning':
              return {
                ...phase,
                runner: { ...phase.runner, instructions: PLAN_NOTE },
                autoStart: true,
                autoStartWhen: EFFORT_LOW,
                exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
              } as StoredPhase;
            case 'pr-review':
              return { ...phase, autoStart: true };
            default:
              return phase;
          }
        });
        expect(board.revision).toBe(2);
        const route = await replica.send('POST', `/web/factory/projects/${projectId}/intake-routes`, {
          name: 'Trusted issues go to Triage',
          when: {
            operator: 'AND',
            conditions: [
              { field: 'author.trusted', operator: 'equals', value: true },
              { field: 'source.kind', operator: 'equals', value: 'issue' },
            ],
          },
          target: { boardKey: 'work', phaseKey: 'triage' },
        });
        expect(route.status, JSON.stringify(route.json)).toBe(201);
      }

      async function githubIssue(
        replica: Awaited<ReturnType<typeof boot>>,
        projectId: string,
        title: string,
        { trusted, labels }: { trusted: boolean; labels: string[] },
      ) {
        const created = await replica.send('POST', `/web/factory/projects/${projectId}/work-items`, {
          title,
          externalSource: { integrationId: 'github', type: 'issue', externalId: `issue:${randomUUID()}` },
          metadata: { authorTrusted: trusted, labels },
        });
        expect(created.status, JSON.stringify(created.json)).toBe(200);
        return created.json.workItem as { id: string; title: string; stages: string[]; revision: number };
      }

      /** The model requests of a run started on `skill` for the card titled `title`. */
      function runsOf(requests: string[], skill: string, title: string) {
        return requests.filter(body => body.includes(`<skill name=\\"${skill}\\">`) && body.includes(title));
      }

      it("runs Shipyard's configuration: edited phases and its intake route change what Factory runs", async () => {
        const requests = stubModel(shipyardAgent);
        const orgId = `org-${randomUUID()}`;
        const replica = await boot(database(), orgId);
        const projectId = await runnableProject(replica, orgId);
        await configureShipyard(replica, projectId);

        const decisionsFor = async (card: { id: string }) =>
          await replica.workItems.listDeferredDecisions(orgId, projectId, { workItemId: card.id });
        const stagesOf = async (card: { id: string }) => (await replica.workItems.get({ orgId, id: card.id }))!.stages;
        const startOf = async (card: { id: string }, skillName: string) =>
          (await decisionsFor(card)).find(
            record => record.decision.type === 'invokeSkill' && record.decision.skillName === skillName,
          );

        // The intake route: trusted issues land in Triage, an outside author's waits in Intake.
        const quick = await githubIssue(replica, projectId, 'Quick fix', { trusted: true, labels: ['effort:low'] });
        const large = await githubIssue(replica, projectId, 'Large rewrite', { trusted: true, labels: [] });
        const outside = await githubIssue(replica, projectId, 'Outside report', { trusted: false, labels: [] });
        expect([quick.stages, large.stages, outside.stages]).toEqual([['triage'], ['triage'], ['intake']]);

        // Triage starts on its own, and its edited instructions reach the run its code handler starts,
        // beside the triage skill.
        await vi.waitFor(() => expect(runsOf(requests, 'factory-triage', 'Quick fix')).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', 'Quick fix')[0]).toContain(TRIAGE_NOTE);
        await vi.waitFor(async () => expect((await startOf(large, 'factory-triage'))?.status).toBe('succeeded'), {
          timeout: 20_000,
        });

        // A board rule moves both cards to Planning. Planning starts on its own for the effort:low
        // card, and its plan is approved for it: the card moves on to Building.
        await ruleMoves(replica, orgId, projectId, quick, 'planning');
        await ruleMoves(replica, orgId, projectId, large, 'planning');
        await vi.waitFor(async () => expect(await stagesOf(quick)).toEqual(['execute']), { timeout: 30_000 });
        expect(runsOf(requests, 'factory-plan', 'Quick fix')[0]).toContain(PLAN_NOTE);

        // The unlabelled card's plan run waits for a person.
        expect(await stagesOf(large)).toEqual(['planning']);
        const largePlan = (await startOf(large, 'factory-plan'))!;
        expect(largePlan.status).toBe('proposed');
        expect(runsOf(requests, 'factory-plan', 'Large rewrite')).toEqual([]);

        // Once a person starts it, its plan is not approved for it: the card stays in Planning.
        const approved = await replica.send(
          'POST',
          `/web/factory/projects/${projectId}/decisions/${largePlan.id}/approve`,
        );
        expect(approved.status, JSON.stringify(approved.json)).toBe(200);
        await vi.waitFor(() => expect(runsOf(requests, 'factory-plan', 'Large rewrite')).not.toEqual([]), {
          timeout: 20_000,
        });
        // Long enough for an auto-approval to have moved the card, as it did the labelled one.
        await new Promise(resolve => setTimeout(resolve, 3_000));
        expect(await stagesOf(large)).toEqual(['planning']);

        // PR review starts its review on its own when a rule moves a pull request card into it.
        const { item: pullRequest } = await replica.workItems.upsert({
          orgId,
          userId: 'admin-user',
          factoryProjectId: projectId,
          input: {
            board: 'work',
            title: 'Add rate limiting',
            externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:42' },
            metadata: { authorTrusted: true, headBranch: 'rate-limiting' },
          },
        });
        expect(pullRequest.stages).toEqual(['intake']);
        await ruleMoves(replica, orgId, projectId, pullRequest, 'pr-review');
        await vi.waitFor(
          async () => {
            const review = (await decisionsFor(pullRequest)).find(record => record.decision.type === 'invokeSkill');
            expect(review).toMatchObject({ status: 'succeeded', decision: { role: 'review' } });
          },
          { timeout: 20_000 },
        );
        expect(runsOf(requests, 'factory-review', 'Add rate limiting')).not.toEqual([]);
      }, 120_000);

      it("moves a card through a new project's Work, which has no Triage, starting Planning's run from Intake", async () => {
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const replica = await boot(database(), orgId);
        const projectId = await runnableProject(replica, orgId, { created: true });
        const work = (await catalog(replica, projectId)).find(board => board.id === 'work')!;
        expect(work.phases.map(phase => phase.id)).toEqual([
          'intake',
          'planning',
          'execute',
          'pr-review',
          'done',
          'canceled',
        ]);

        const card = await githubIssue(replica, projectId, 'Straight to planning', { trusted: true, labels: [] });
        expect(card.stages).toEqual(['intake']);
        const move = (current: { id: string; revision: number }, stage: string) =>
          replica.send('POST', `/web/factory/projects/${projectId}/work-items/${current.id}/transition`, {
            board: 'work',
            stage,
            expectedRevision: current.revision,
            requestId: randomUUID(),
            cause: 'card_action',
          });
        // Nothing moves a card into Triage: the board has none.
        expect((await move(card, 'triage')).json.result).toMatchObject({ status: 'rejected' });
        const planned = await move((await replica.workItems.get({ orgId, id: card.id }))!, 'planning');
        expect(planned.json.result, JSON.stringify(planned.json)).toMatchObject({
          status: 'accepted',
          stage: 'planning',
        });
        await vi.waitFor(() => expect(runsOf(requests, 'factory-plan', card.title)).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', card.title)).toEqual([]);

        for (const stage of ['execute', 'done']) {
          const result = await move((await replica.workItems.get({ orgId, id: card.id }))!, stage);
          expect(result.json.result, `${stage}: ${JSON.stringify(result.json)}`).toMatchObject({
            status: 'accepted',
            stage,
          });
        }
      }, 120_000);

      it("runs a project's unedited Work board from its row", async () => {
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const replica = await boot(database(), orgId);
        const projectId = await runnableProject(replica, orgId);
        const scope = { orgId, factoryProjectId: projectId };

        // Creating the project stored its Work board. Change Triage in the database itself, the
        // way an operator or a migration would, so the copy stays unedited.
        const triage = (await replica.boards.get(scope, 'work'))!.phases.find(phase => phase.key === 'triage')!;
        const where = { org_id: orgId, factory_project_id: projectId };
        await replica.storage.ops.updateMany(
          'factory_board_phases',
          { ...where, board_key: 'work', phase_key: 'triage' },
          { auto_start: true, runner: { ...triage.runner, instructions: TRIAGE_NOTE } },
        );
        await replica.storage.ops.updateMany('factory_board_definition_versions', where, { version: randomUUID() });
        const route = await replica.send('POST', `/web/factory/projects/${projectId}/intake-routes`, {
          name: 'Trusted issues go to Triage',
          when: { operator: 'AND', conditions: [{ field: 'author.trusted', operator: 'equals', value: true }] },
          target: { boardKey: 'work', phaseKey: 'triage' },
        });
        expect(route.status, JSON.stringify(route.json)).toBe(201);

        const workOn = async () =>
          (await catalog(replica, projectId)).find(board => board.id === 'work') as {
            phases: { id: string; autoStart?: boolean }[];
          };
        await vi.waitFor(
          async () =>
            expect((await workOn()).phases.find(phase => phase.id === 'triage')).toMatchObject({ autoStart: true }),
          { timeout: 5_000 },
        );
        expect((await replica.boards.get({ orgId, factoryProjectId: projectId }, 'work'))!.revision).toBe(1);

        const card = await githubIssue(replica, projectId, 'Straight from the row', { trusted: true, labels: [] });
        expect(card.stages).toEqual(['triage']);
        await vi.waitFor(() => expect(runsOf(requests, 'factory-triage', card.title)).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', card.title)[0]).toContain(TRIAGE_NOTE);
      }, 60_000);

      it("keeps a project's edited Work board when Factory restarts on a release with a different Work default", async () => {
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const newStorage = database();
        const before = await boot(newStorage, orgId);
        const projectId = await runnableProject(before, orgId);
        const scope = { orgId, factoryProjectId: projectId };
        await configureShipyard(before, projectId);
        const version = await before.boards.readVersion(scope);

        // The next release ships a different Work default.
        const seeds = ProjectBoardCache.prototype.seeds;
        const release = vi
          .spyOn(ProjectBoardCache.prototype, 'seeds')
          .mockImplementation(function (this: ProjectBoardCache) {
            return seeds.call(this).map(board =>
              board.key === 'work'
                ? {
                    ...board,
                    name: 'Work v2',
                    phases: board.phases.map(phase =>
                      phase.key === 'triage'
                        ? { ...phase, runner: { ...phase.runner, instructions: NEW_DEFAULT } }
                        : phase,
                    ),
                  }
                : board,
            );
          });
        onTestFinished(() => release.mockRestore());
        const after = await boot(newStorage, orgId);

        expect(release).toHaveBeenCalled();
        expect(await after.boards.readVersion(scope)).toBe(version);
        expect((await after.boards.get(scope, 'work'))!).toMatchObject({ name: 'Work', revision: 2 });
        const card = await githubIssue(after, projectId, 'After the release', { trusted: true, labels: [] });
        expect(card.stages).toEqual(['triage']);
        await vi.waitFor(() => expect(runsOf(requests, 'factory-triage', card.title)).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', card.title)[0]).toContain(TRIAGE_NOTE);
        expect(runsOf(requests, 'factory-triage', card.title)[0]).not.toContain(NEW_DEFAULT);
      }, 60_000);

      it('applies an edit made on one replica to the runs another replica starts, until the board is reset', async () => {
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const newStorage = database();
        const a = await boot(newStorage, orgId);
        const projectId = await runnableProject(a, orgId);
        const b = await boot(newStorage, orgId);
        await configureShipyard(a, projectId);

        // Replica B serves the edit once its recheck window passes, then files a card and runs
        // Triage as replica A edited it.
        const workOn = async (replica: Awaited<ReturnType<typeof boot>>) =>
          (await catalog(replica, projectId))
            .find(board => board.id === 'work')
            ?.phases.find(phase => phase.id === 'triage') as { autoStart?: boolean } | undefined;
        await vi.waitFor(async () => expect(await workOn(b)).toMatchObject({ autoStart: true }), { timeout: 5_000 });
        const before = await githubIssue(b, projectId, 'Before reset', { trusted: true, labels: [] });
        expect(before.stages).toEqual(['triage']);
        await vi.waitFor(() => expect(runsOf(requests, 'factory-triage', before.title)).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', before.title)[0]).toContain(TRIAGE_NOTE);

        // Replica A resets Work to its code default.
        const work = await a.send('GET', `/web/factory/projects/${projectId}/boards/work`);
        const reset = await a.send('POST', `/web/factory/projects/${projectId}/boards/work/reset`, {
          expectedRevision: work.json.board.revision,
        });
        expect(reset.status, JSON.stringify(reset.json)).toBe(200);
        // Reset rewrites the row at the next revision rather than deleting it.
        expect(reset.json.board).toMatchObject({ name: 'Work', revision: work.json.board.revision + 1 });

        // After its recheck window, replica B's Triage waits for a person again, and the run a
        // person starts carries no Shipyard instructions.
        await vi.waitFor(async () => expect((await workOn(b))?.autoStart).toBeFalsy(), { timeout: 5_000 });
        const after = await githubIssue(b, projectId, 'After reset', { trusted: true, labels: [] });
        expect(after.stages).toEqual(['triage']);
        const triage = await vi.waitFor(
          async () => {
            const start = (await b.workItems.listDeferredDecisions(orgId, projectId, { workItemId: after.id })).find(
              record => record.decision.type === 'invokeSkill',
            );
            expect(start?.status).toBe('proposed');
            return start!;
          },
          { timeout: 10_000 },
        );
        const approved = await b.send('POST', `/web/factory/projects/${projectId}/decisions/${triage.id}/approve`);
        expect(approved.status, JSON.stringify(approved.json)).toBe(200);
        await vi.waitFor(() => expect(runsOf(requests, 'factory-triage', after.title)).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-triage', after.title)[0]).not.toContain(TRIAGE_NOTE);
      }, 120_000);

      describe('upsertBoard()', () => {
        it('writes a board into every project, over the ones that have it, and audits each write', async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          const [first, edited, third] = [
            await createProject(replica, 'First'),
            await createProject(replica, 'Edited'),
            await createProject(replica, 'Third'),
          ];
          const ours = await replica.send('POST', `/web/factory/projects/${edited}/boards`, {
            ...bugsBoard,
            name: 'Our bugs',
          });
          expect(ours.status).toBe(201);

          const result = await replica.factory.upsertBoard(bugsBoard, { projects: 'all' });
          expect(result.inserted.map(scope => scope.factoryProjectId).sort()).toEqual([first, third].sort());
          expect(result.updated).toEqual([{ orgId, factoryProjectId: edited }]);
          expect(result.unchanged).toEqual([]);
          expect((await replica.boards.get({ orgId, factoryProjectId: edited }, 'bugs'))!).toMatchObject({
            name: 'Bugs',
            revision: 2,
          });
          // Served at once on this replica, not after the recheck window.
          expect((await catalog(replica, first)).map(board => board.id)).toContain('bugs');
          const card = await replica.send('POST', `/web/factory/projects/${first}/work-items`, {
            board: 'bugs',
            title: 'Crash on save',
          });
          expect(card.status).toBe(200);
          expect((await transition(replica, first, card.json.workItem, 'fixing')).json.result).toMatchObject({
            status: 'accepted',
            stage: 'fixing',
          });

          // Run again, it writes nothing; a project that deleted the board gets it back.
          const deleted = await replica.send('DELETE', `/web/factory/projects/${third}/boards/bugs?expectedRevision=1`);
          expect(deleted.status).toBe(204);
          const again = await replica.factory.upsertBoard(bugsBoard, { projects: 'all' });
          expect(again.inserted).toEqual([{ orgId, factoryProjectId: third }]);
          expect(again.updated).toEqual([]);
          expect(again.unchanged).toHaveLength(2);

          // A project created later gets it too, and so has boards: Factory adds no Work to it.
          const later = await createProject(replica, 'Later');
          expect((await catalog(replica, later)).map(board => board.id)).toEqual(['bugs']);

          const audit = (projectId: string) =>
            replica.storage
              .getDomain<AuditStorage>('audit')
              .list({ orgId, factoryProjectId: projectId, actions: ['factory.board.created', 'factory.board.updated'] })
              .then(page => page.events.map(event => [event.action, event.actorType, event.actorId]));
          expect(await audit(first)).toEqual([['factory.board.created', 'system', 'factory']]);
          expect(await audit(edited)).toEqual([
            ['factory.board.updated', 'system', 'factory'],
            ['factory.board.created', 'human', 'admin-user'],
          ]);

          // A card sits in Fixing, so a definition without that phase is refused there.
          await expect(
            replica.factory.upsertBoard(
              {
                ...bugsBoard,
                phases: [
                  { key: 'reported', name: 'Reported', kind: 'resting', nextPhases: ['fixed'] },
                  { key: 'fixed', name: 'Fixed', kind: 'terminal' },
                ],
              },
              { projects: [{ orgId, factoryProjectId: first }] },
            ),
          ).rejects.toMatchObject({ code: 'phase_in_use' });
          // `review` is a key like any other, once the retired Review board has no open card left:
          // the board is stored, the retired board's cards stay on Work, and a card on it stays on it.
          const retired = (number: number, stage: string) =>
            replica.workItems.upsert({
              orgId,
              factoryProjectId: first,
              userId: 'admin-user',
              input: {
                title: `PR ${number}`,
                board: 'review',
                stages: [stage],
                externalSource: { integrationId: 'github', type: 'pull-request', externalId: `github-pr:${number}` },
              },
            });
          const merged = await retired(1, 'done');
          const waiting = await retired(2, 'review');
          const upsertReview = () =>
            replica.factory.upsertBoard(
              { ...bugsBoard, key: 'review' },
              { projects: [{ orgId, factoryProjectId: first }] },
            );
          await expect(upsertReview()).rejects.toMatchObject({ code: 'board_in_use' });
          await replica.workItems.update({
            orgId,
            id: waiting.item.id,
            userId: 'admin-user',
            patch: { stages: ['canceled'] },
          });
          const review = await upsertReview();
          expect(review.inserted).toEqual([{ orgId, factoryProjectId: first }]);
          expect(await replica.workItems.get({ orgId, id: merged.item.id })).toMatchObject({
            board: 'work',
            stages: ['done'],
          });
          expect(await replica.workItems.get({ orgId, id: waiting.item.id })).toMatchObject({
            board: 'work',
            stages: ['canceled'],
          });
          const reviewCard = await replica.send('POST', `/web/factory/projects/${first}/work-items`, {
            board: 'review',
            title: 'Typo in the docs',
          });
          expect(reviewCard.status).toBe(200);
          expect(await replica.workItems.get({ orgId, id: reviewCard.json.workItem.id })).toMatchObject({
            board: 'review',
            stages: ['reported'],
          });
          // Work's key is checked against Work's code behaviour, as an edit is.
          await expect(
            replica.factory.upsertBoard({ ...bugsBoard, key: 'work' }, { projects: 'all' }),
          ).rejects.toMatchObject({ code: 'code_behaviour' });
          await expect(
            replica.factory.upsertBoard({ ...bugsBoard, phases: [] }, { projects: 'all' }),
          ).rejects.toMatchObject({ code: 'invalid_board' });
          await expect(
            replica.factory.upsertBoard(bugsBoard, { projects: [{ orgId, factoryProjectId: randomUUID() }] }),
          ).rejects.toMatchObject({ code: 'project_not_found' });
        }, 60_000);

        it('stores the Work board the README shows for replacing Work in every project, over edits and cards in Triage, and keeps it through a reset', async () => {
          stubModel();
          // The README, not the changeset: `changeset version` deletes changesets.
          const ourWorkBoard = documentedWorkBoard('../../README.md');
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          const created = await createProject(replica, 'Onboarded');
          const older = await createOlderProject(replica, orgId, 'Older');
          const [createdScope, olderScope] = [created, older].map(factoryProjectId => ({ orgId, factoryProjectId }));
          const read = await replica.send('GET', `/web/factory/projects/${created}/boards/work`);
          const before = read.json.board as { phases: unknown[]; revision: number };
          const edit = await replica.send('PATCH', `/web/factory/projects/${created}/boards/work`, {
            expectedRevision: before.revision,
            name: 'Our edit',
            phases: before.phases,
          });
          expect(edit.status, JSON.stringify(edit.json)).toBe(200);
          // An older project's Work has Triage, and a card sits in it.
          const filed = await replica.send('POST', `/web/factory/projects/${older}/work-items`, {
            board: 'work',
            title: 'Investigating a crash',
          });
          expect(filed.status, JSON.stringify(filed.json)).toBe(200);
          const card = filed.json.workItem as { id: string; revision: number };
          const triaged = await replica.send(
            'POST',
            `/web/factory/projects/${older}/work-items/${card.id}/transition`,
            {
              board: 'work',
              stage: 'triage',
              expectedRevision: card.revision,
              requestId: randomUUID(),
              cause: 'stored-board-test',
            },
          );
          expect(triaged.json.result, JSON.stringify(triaged.json)).toMatchObject({
            status: 'accepted',
            stage: 'triage',
          });

          const result = await replica.factory.upsertBoard(ourWorkBoard, { projects: 'all' });

          expect(result.updated).toEqual(expect.arrayContaining([createdScope, olderScope]));
          expect(result.inserted).toEqual([]);
          for (const scope of [createdScope, olderScope]) {
            const row = (await replica.boards.get(scope, 'work'))!;
            // Replaced at the row's current revision: the Settings edit is gone.
            expect(row.name).toBe('Work');
            expect(row.phases.map(phase => [phase.key, phase.name])).toEqual(
              ourWorkBoard.phases.map(phase => [phase.key, phase.name]),
            );
          }
          const later = await createProject(replica, 'Later');
          expect(
            (await replica.boards.get({ orgId, factoryProjectId: later }, 'work'))!.phases.map(p => p.key),
          ).toEqual(ourWorkBoard.phases.map(phase => phase.key));

          // Reset restores the app's board, not Factory's Work.
          const row = (await replica.boards.get(olderScope, 'work'))!;
          const reset = await replica.send('POST', `/web/factory/projects/${older}/boards/work/reset`, {
            expectedRevision: row.revision,
          });
          expect(reset.status).toBe(200);
          const restored = (await replica.boards.get(olderScope, 'work'))!.phases.map(phase => phase.key);
          expect(restored).toEqual(ourWorkBoard.phases.map(phase => phase.key));
          const listed = await replica.send('GET', `/web/factory/projects/${older}/work-items`);
          const kept = (listed.json.workItems as { id: string; stages: string[] }[]).find(item => item.id === card.id);
          expect(kept?.stages).toEqual(['triage']);
        }, 60_000);

        it('stores the boards an app upserts for all projects in a project created later, and no Work beside them', async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const db = await isolatedDatabase();
          const replica = await boot(db, orgId);
          // The app installs its boards at startup, before anyone has onboarded.
          const appWork = { ...workSeedWithTriage(), name: 'Ship work' };
          expect(await replica.factory.upsertBoard(appWork, { projects: 'all' })).toEqual({
            inserted: [],
            updated: [],
            unchanged: [],
          });
          await replica.factory.upsertBoard(bugsBoard, { projects: 'all' });

          const projectId = await createProject(replica, 'Onboarded');
          const scope = { orgId, factoryProjectId: projectId };

          expect((await replica.boards.list(scope)).map(row => [row.key, row.name, row.revision])).toEqual([
            ['work', 'Ship work', 1],
            ['bugs', 'Bugs', 1],
          ]);
          expect((await catalog(replica, projectId)).map(board => board.id)).toEqual(['work', 'bugs']);
          // A restart stores nothing more: the project has the app's boards, so Factory's Work never goes in.
          const version = await replica.boards.readVersion(scope);
          const restarted = await boot(db, orgId);
          expect((await catalog(restarted, projectId)).map(board => board.id)).toEqual(['work', 'bugs']);
          expect((await restarted.boards.get(scope, 'work'))!).toMatchObject({ name: 'Ship work', revision: 1 });
          expect(await restarted.boards.readVersion(scope)).toBe(version);
        }, 60_000);

        it("resets an app's Work in a project created after the upsert to the app's board, not Factory's", async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          const appWork = { ...workSeedWithTriage(), name: 'Ship work' };
          await replica.factory.upsertBoard(appWork, { projects: 'all' });
          const projectId = await createProject(replica, 'Onboarded');
          const scope = { orgId, factoryProjectId: projectId };
          const row = (await replica.boards.get(scope, 'work'))!;

          const reset = await replica.send('POST', `/web/factory/projects/${projectId}/boards/work/reset`, {
            expectedRevision: row.revision,
          });

          expect(reset.status, JSON.stringify(reset.json)).toBe(200);
          const after = (await replica.boards.get(scope, 'work'))!;
          expect(after.name).toBe('Ship work');
          expect(after.phases.map(phase => phase.key)).toContain('triage');
        }, 60_000);

        it("never runs Factory's one-board Work migrations on a Work the app upserts for every project", async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          // Planning's runner as releases before phase runners stored it: the Work migration would add its skill.
          const seed = workSeedWithTriage();
          const appWork = {
            ...seed,
            name: 'Ship work',
            phases: seed.phases.map(phase =>
              phase.key === 'planning' ? { ...phase, runner: { context: 'work' } } : phase,
            ),
          };
          await replica.factory.upsertBoard(appWork, { projects: 'all' });

          const projectId = await createProject(replica, 'Onboarded');

          const scope = { orgId, factoryProjectId: projectId };
          expect((await catalog(replica, projectId)).map(board => board.id)).toEqual(['work']);
          const planning = (await replica.boards.get(scope, 'work'))!.phases.find(phase => phase.key === 'planning')!;
          expect(planning.runner).toEqual({ context: 'work' });
        }, 60_000);

        it("gives a project the app's board alone when the app upserts only another key", async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          await replica.factory.upsertBoard(bugsBoard, { projects: 'all' });

          const projectId = await createProject(replica, 'Bugs only');

          expect((await replica.boards.list({ orgId, factoryProjectId: projectId })).map(row => row.key)).toEqual([
            'bugs',
          ]);
        }, 60_000);

        it("files a work-less project's GitHub arrivals on the app's board, where its routes place them", async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const replica = await boot(await isolatedDatabase(), orgId);
          await replica.factory.upsertBoard(opsBoard, { projects: 'all' });
          const projectId = await createProject(replica, 'Ops only');
          const scope = { orgId, factoryProjectId: projectId };
          expect((await replica.boards.list(scope)).map(row => row.key)).toEqual(['ops']);
          const route = await replica.send('POST', `/web/factory/projects/${projectId}/intake-routes`, {
            name: 'Pull requests go to Ops review',
            when: {
              operator: 'AND',
              conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }],
            },
            target: { boardKey: 'ops', phaseKey: 'review' },
          });
          expect(route.status, JSON.stringify(route.json)).toBe(201);

          const sourceControl = replica.github.sourceControlStorage;
          const installation = await sourceControl.installations.upsert({
            orgId,
            connectedByUserId: 'admin-user',
            externalId: '7',
          });
          const repository = await sourceControl.repositories.upsert({
            orgId,
            input: { installationId: installation.id, externalId: '10', slug: 'acme/ops', defaultBranch: 'main' },
          });
          const connection = await sourceControl.connections.create({
            orgId,
            factoryProjectId: projectId,
            installationId: installation.id,
            createdByUserId: 'admin-user',
          });
          await sourceControl.projectRepositories.link({
            orgId,
            connectionId: connection.id,
            repositoryId: repository.id,
            createdByUserId: 'admin-user',
            sandboxProvider: 'local',
            sandboxWorkdir: '/workspace',
          });

          // The GitHub rules and dispatcher Factory runs, over the project's stored boards.
          const workItems = replica.workItems;
          const boards = new ProjectBoardCache({
            codeRegistry: createBoardRegistry(),
            storage: replica.boards,
            recheckMs: 0,
          });
          const configVersion = 'work-less-arrivals-v1';
          const rules = new GithubRules({
            github: {
              rules: resolveGithubRules(),
              slug: 'factory-app',
              getRepositoryCollaboratorPermission: vi.fn().mockResolvedValue('write'),
            } as never,
            sourceControl,
            integrationStorage: replica.storage.getDomain<IntegrationStorage>('integrations').forIntegration('github'),
            projects: replica.storage.getDomain<FactoryProjectsStorage>('projects'),
            storage: workItems,
            boards,
            configVersion,
          });
          const dispatcher = new FactoryDecisionDispatcher({
            controller: { getSession: vi.fn(async () => undefined), listActiveThreadRuns: () => [] } as never,
            transitionService: new FactoryTransitionService({ storage: workItems, configVersion, boards }),
            storage: workItems,
            boards,
            intakeRoutes: replica.boards,
            ownerId: 'work-less-arrivals',
          });
          let tick = 0;
          const deliver = async (delivery: unknown) => {
            expect(await rules.ingest(delivery as never)).toEqual({ status: 'committed' });
            for (let pass = 0; pass < 3; pass++) {
              await dispatcher.runOnce(new Date(Date.parse('2030-01-01T00:00:00Z') + 1000 * tick++));
            }
          };
          const sender = { installation: { id: 7 }, repository: { id: 10, full_name: 'acme/ops' } };
          await deliver({
            event: 'issues',
            deliveryId: `issue-${randomUUID()}`,
            payload: {
              action: 'opened',
              ...sender,
              sender: { login: 'maintainer' },
              issue: { number: 42, title: 'Disk alert', html_url: 'https://github.com/acme/ops/issues/42' },
            },
          });
          await deliver({
            event: 'pull_request',
            deliveryId: `pr-${randomUUID()}`,
            payload: {
              action: 'opened',
              ...sender,
              sender: { login: 'maintainer' },
              pull_request: {
                number: 17,
                title: 'Raise the disk limit',
                html_url: 'https://github.com/acme/ops/pull/17',
                state: 'open',
                merged: false,
                head: { ref: 'raise-disk-limit', sha: 'abc1234def000000000000000000000000000000' },
                base: { ref: 'main' },
              },
            },
          });

          const cards = await workItems.list(scope);
          // No route takes the issue: it lands on the project's first board, in its initial phase.
          expect(cards.find(card => card.title === 'Disk alert')).toMatchObject({ board: 'ops', stages: ['inbox'] });
          expect(cards.find(card => card.title === 'Raise the disk limit')).toMatchObject({
            board: 'ops',
            stages: ['review'],
          });
          expect(cards).toHaveLength(2);

          // A card a person files without a board lands there too.
          const filed = await replica.send('POST', `/web/factory/projects/${projectId}/work-items`, {
            title: 'Rotate keys',
          });
          expect(filed.status, JSON.stringify(filed.json)).toBe(200);
          expect(filed.json.workItem).toMatchObject({ board: 'ops', stages: ['inbox'] });
        }, 60_000);

        it("keeps a new project's edited Work board across a restart that upserts another board", async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const db = await isolatedDatabase();
          const replica = await boot(db, orgId);
          const projectId = await createProject(replica, 'Edited after onboarding');
          const scope = { orgId, factoryProjectId: projectId };
          const work = (await replica.send('GET', `/web/factory/projects/${projectId}/boards/work`)).json.board;
          expect(work.phases.map((phase: { key: string }) => phase.key)).not.toContain('triage');
          const edited = await replica.send('PATCH', `/web/factory/projects/${projectId}/boards/work`, {
            name: 'Our work',
            phases: work.phases,
            expectedRevision: work.revision,
          });
          expect(edited.status, JSON.stringify(edited.json)).toBe(200);

          const restarted = await boot(db, orgId);
          await restarted.factory.upsertBoard(bugsBoard, { projects: 'all' });

          expect((await restarted.boards.get(scope, 'work'))!).toMatchObject({ name: 'Our work', revision: 2 });
          expect((await catalog(restarted, projectId)).map(board => board.id)).toEqual(['work', 'bugs']);
        }, 60_000);

        it('lets two replicas write the same board into a project at once, each write landing', async () => {
          stubModel();
          const orgId = `org-${randomUUID()}`;
          const db = await isolatedDatabase();
          const [a, b] = [await boot(db, orgId), await boot(db, orgId)];
          const project = await createProject(a, 'Raced');
          const scope = [{ orgId, factoryProjectId: project }];
          const results = await Promise.all([
            a.factory.upsertBoard({ ...bugsBoard, name: 'Bugs A' }, { projects: scope }),
            b.factory.upsertBoard({ ...bugsBoard, name: 'Bugs B' }, { projects: scope }),
          ]);
          // One stored it and the other replaced it, after rereading when the insert lost.
          expect(results.flatMap(result => [...result.inserted, ...result.updated])).toHaveLength(2);
          expect((await a.boards.get({ orgId, factoryProjectId: project }, 'bugs'))!.revision).toBe(2);
        }, 60_000);
      });

      it('brings back an app board a project deleted, in the projects named, and nowhere else', async () => {
        stubModel();
        const orgId = `org-${randomUUID()}`;
        const release = compileBoardDefinition({
          id: 'release',
          name: 'Release',
          initialPhase: 'queued',
          phases: {
            queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
            shipping: {
              name: 'Shipping',
              kind: 'working',
              runner: { context: 'work', skill: 'factory-plan' },
              nextPhases: ['shipped'],
            },
            shipped: { name: 'Shipped', kind: 'terminal' },
          },
        });
        const db = await isolatedDatabase();
        const replica = await boot(db, orgId, { boards: [release] });
        const [kept, gone, other] = [
          await createProject(replica, 'Kept'),
          await createProject(replica, 'Gone'),
          await createProject(replica, 'Other'),
        ];
        for (const project of [gone, other]) {
          const deleted = await replica.send(
            'DELETE',
            `/web/factory/projects/${project}/boards/release?expectedRevision=1`,
          );
          expect(deleted.status).toBe(204);
        }
        const definition = (await replica.send('GET', `/web/factory/projects/${kept}/boards/release`)).json.board;

        const result = await replica.factory.upsertBoard(
          { key: 'release', name: definition.name, phases: definition.phases },
          {
            projects: [
              { orgId, factoryProjectId: kept },
              { orgId, factoryProjectId: gone },
            ],
          },
        );
        expect(result).toEqual({
          inserted: [{ orgId, factoryProjectId: gone }],
          updated: [],
          unchanged: [{ orgId, factoryProjectId: kept }],
        });
        const back = await catalog(replica, gone);
        expect(back.find(board => board.id === 'release')).toMatchObject({ source: 'app' });
        // It runs again: entering its working phase queues that phase's runner; the project not named stays without it.
        const base = `/web/factory/projects/${gone}`;
        const card = (await replica.send('POST', `${base}/work-items`, { board: 'release', title: 'Ship it' })).json
          .workItem;
        const moved = await replica.send('POST', `${base}/work-items/${card.id}/transition`, {
          board: 'release',
          stage: 'shipping',
          expectedRevision: card.revision,
          requestId: randomUUID(),
          cause: 'test',
        });
        expect(moved.status).toBe(200);
        const runs = await replica.workItems.listDeferredDecisions(orgId, gone, { workItemId: card.id });
        expect(runs.map(record => record.decision)).toContainEqual(
          expect.objectContaining({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' }),
        );
        expect((await replica.boards.get({ orgId, factoryProjectId: gone }, 'release'))!.revision).toBe(1);
        expect(await replica.boards.get({ orgId, factoryProjectId: other }, 'release')).toBeNull();

        // A restart stores it nowhere again.
        const restarted = await boot(db, orgId, { boards: [release] });
        await catalog(restarted, other);
        expect(await restarted.boards.get({ orgId, factoryProjectId: other }, 'release')).toBeNull();
      }, 60_000);

      it("changes what Work runs through the boards API, and refuses a change Work's code behaviour can't honour", async () => {
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const replica = await boot(database(), orgId);
        const projectId = await runnableProject(replica, orgId);
        const read = await replica.send('GET', `/web/factory/projects/${projectId}/boards/work`);
        const work = read.json.board as { name: string; revision: number; phases: StoredPhase[] };
        const patch = (phases: StoredPhase[], expectedRevision = work.revision) =>
          replica.send('PATCH', `/web/factory/projects/${projectId}/boards/work`, {
            name: work.name,
            phases,
            expectedRevision,
          });

        const saved = await patch(
          work.phases.map(phase =>
            phase.key === 'planning'
              ? {
                  ...phase,
                  runner: { ...phase.runner, instructions: PLAN_NOTE },
                  autoStart: true,
                  autoStartWhen: EFFORT_LOW,
                }
              : phase,
          ) as StoredPhase[],
        );
        expect(saved.status, JSON.stringify(saved.json)).toBe(200);

        // A rule moves both cards to Planning: the labelled card's plan run starts with no one
        // approving it; the other waits for a person.
        const quick = await githubIssue(replica, projectId, 'Quick fix', { trusted: false, labels: ['effort:low'] });
        const large = await githubIssue(replica, projectId, 'Large rewrite', { trusted: false, labels: [] });
        await ruleMoves(replica, orgId, projectId, quick, 'planning');
        await ruleMoves(replica, orgId, projectId, large, 'planning');
        await vi.waitFor(() => expect(runsOf(requests, 'factory-plan', 'Quick fix')).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-plan', 'Quick fix')[0]).toContain(PLAN_NOTE);
        const largePlan = (
          await replica.workItems.listDeferredDecisions(orgId, projectId, { workItemId: large.id })
        ).find(record => record.decision.type === 'invokeSkill');
        expect(largePlan?.status).toBe('proposed');

        // Runner fields are the project's to edit: no code handler holds Triage's context any more.
        const recontexted = await patch(
          work.phases.map(phase =>
            phase.key === 'triage' ? { ...phase, runner: { ...phase.runner, context: 'work' } } : phase,
          ) as StoredPhase[],
          saved.json.board.revision,
        );
        expect(recontexted.status, JSON.stringify(recontexted.json)).toBe(200);

        // What Work's code still depends on stays locked: Done closes cards when their source closes.
        const conflicting = await patch(
          work.phases.map(phase => (phase.key === 'done' ? { ...phase, kind: 'resting' } : phase)) as StoredPhase[],
          recontexted.json.board.revision,
        );
        expect(conflicting).toMatchObject({
          status: 422,
          json: {
            error: 'code_behaviour',
            message: 'Phase "done" must stay terminal; its code behaviour depends on it.',
          },
        });
      }, 60_000);

      it("runs an edited Triage runner — another skill, with its instructions — instead of Work's seed", async () => {
        const TRIAGE_NOTE = 'Shipyard: label the card before anything else.';
        const requests = stubModel();
        const orgId = `org-${randomUUID()}`;
        const replica = await boot(database(), orgId);
        const projectId = await runnableProject(replica, orgId);
        const read = await replica.send('GET', `/web/factory/projects/${projectId}/boards/work`);
        const work = read.json.board as { name: string; revision: number; phases: StoredPhase[] };
        const saved = await replica.send('PATCH', `/web/factory/projects/${projectId}/boards/work`, {
          name: work.name,
          expectedRevision: work.revision,
          phases: work.phases.map(phase =>
            phase.key === 'triage'
              ? {
                  ...phase,
                  runner: { ...phase.runner, skill: 'factory-plan', instructions: TRIAGE_NOTE },
                  autoStart: true,
                }
              : phase,
          ),
        });
        expect(saved.status, JSON.stringify(saved.json)).toBe(200);

        const card = await githubIssue(replica, projectId, 'Edited triage', { trusted: true, labels: [] });
        await ruleMoves(replica, orgId, projectId, card, 'triage');
        await vi.waitFor(() => expect(runsOf(requests, 'factory-plan', 'Edited triage')).not.toEqual([]), {
          timeout: 20_000,
        });
        expect(runsOf(requests, 'factory-plan', 'Edited triage')[0]).toContain(TRIAGE_NOTE);
        const runs = (await replica.workItems.listDeferredDecisions(orgId, projectId, { workItemId: card.id })).filter(
          record => record.decision.type === 'invokeSkill',
        );
        // The stored runner is the only start path: Work's seeded factory-triage never runs.
        expect(runs.map(record => record.decision)).toEqual([
          expect.objectContaining({ role: 'triage', skillName: 'factory-plan' }),
        ]);
        expect(runsOf(requests, 'factory-triage', 'Edited triage')).toEqual([]);
      }, 60_000);
    });
  },
);
