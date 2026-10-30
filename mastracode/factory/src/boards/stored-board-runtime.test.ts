import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import type { FactoryStorage } from '@mastra/core/storage';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { StoredBoardInput, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

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

/** The model, at the wire: every run gets a short text answer, and each request body is kept. */
function stubModel() {
  vi.stubEnv('OPENAI_API_KEY', 'sk-stored-boards-test');
  const requests: string[] = [];
  onTestFinished(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    requests.push(input instanceof Request ? await input.clone().text() : String(init?.body ?? ''));
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
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), {
      headers: { 'content-type': 'text/event-stream' },
    });
  });
  return requests;
}

/** A board an admin added to a project; it lives only in that project's database. */
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

    /** Boots one replica: a real `MastraFactory` with its API mounted on Hono. */
    async function boot(newStorage: () => FactoryStorage, orgId: string) {
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
        return { status: response.status, json: (await response.json()) as any };
      };
      return {
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

    it('lists the stored board next to the read-only code boards and moves cards through its phases', async () => {
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
        ['work', 'builtin', false],
        ['review', 'builtin', false],
        ['bugs', 'stored', true],
      ]);
      const work = boards.find(board => board.id === 'work')!;
      expect(work.phases.map(phase => `${phase.id}:${phase.name}`)).toEqual([
        'intake:Intake',
        'triage:Triage',
        'planning:Planning',
        'execute:Building',
        'review:Review',
        'pr-review:PR review',
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

      const skipped = await transition(replica, projectId, card, 'fixed');
      expect(skipped.json.result).toMatchObject({ status: 'rejected' });
      const undeclared = await transition(replica, projectId, card, 'review');
      expect(undeclared.json.result).toMatchObject({ status: 'rejected' });
      expect(await replica.workItems.get({ orgId, id: card.id })).toMatchObject({ stages: ['reported'] });

      const fixing = await transition(replica, projectId, card, 'fixing');
      expect(fixing.json.result).toMatchObject({ status: 'accepted', stage: 'fixing' });
      const fixed = await transition(replica, projectId, { id: card.id, revision: card.revision + 1 }, 'fixed');
      expect(fixed.json.result).toMatchObject({ status: 'accepted', stage: 'fixed' });

      expect((await catalog(replica, otherProjectId)).map(board => board.id)).toEqual(['work', 'review']);
      const elsewhere = await replica.send('POST', `/web/factory/projects/${otherProjectId}/work-items`, {
        board: 'bugs',
        title: 'Not here',
      });
      expect(elsewhere.status).not.toBe(200);
    }, 30_000);

    it('keeps the phases agents may move cards into through create, reload and the catalog', async () => {
      stubModel();
      const orgId = `org-${randomUUID()}`;
      const newStorage = database();
      const replica = await boot(newStorage, orgId);
      const projectId = await createProject(replica, 'Gated project');
      const onlyFromReported = {
        operator: 'AND',
        conditions: [{ field: 'item.phase', operator: 'equals', value: 'reported' }],
      };
      const gated = {
        ...bugsBoard,
        key: 'gated-bugs',
        phases: bugsBoard.phases.map(phase =>
          phase.key === 'fixing'
            ? { ...phase, agentEnterWhen: onlyFromReported }
            : phase.key === 'fixed'
              ? { ...phase, agentEnterWhen: false }
              : phase,
        ),
      };

      const created = await replica.send('POST', `/web/factory/projects/${projectId}/boards`, gated);
      expect(created.status).toBe(201);

      // A second replica reads the rows the first wrote.
      const restarted = await boot(newStorage, orgId);
      const stored = await restarted.send('GET', `/web/factory/projects/${projectId}/boards/gated-bugs`);
      const storedPhases = Object.fromEntries(
        (stored.json.board.phases as { key: string; agentEnterWhen?: unknown }[]).map(phase => [
          phase.key,
          phase.agentEnterWhen,
        ]),
      );
      // Stored rows read back null where no condition was set, like the other nullable phase fields.
      expect(storedPhases).toEqual({
        reported: null,
        fixing: onlyFromReported,
        fixed: false,
        wontfix: null,
      });

      const listed = (await catalog(restarted, projectId)).find(board => board.id === 'gated-bugs')!;
      const listedPhases = Object.fromEntries(
        (listed.phases as { id: string; agentEnterWhen?: unknown }[]).map(phase => [phase.id, phase.agentEnterWhen]),
      );
      expect(listedPhases).toEqual({
        reported: undefined,
        fixing: onlyFromReported,
        fixed: false,
        wontfix: undefined,
      });
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
  },
);
