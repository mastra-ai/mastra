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
import type { StoredBoardsStorage, StoredPhaseInput } from '../storage/domains/boards/base.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
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

/**
 * The admin's edit of the stored Work board, made straight in storage: Building is renamed,
 * Review is removed, and a resting "Parked" and a terminal "Abandoned" phase are added.
 */
function editWork(phases: StoredPhaseInput[]): StoredPhaseInput[] {
  const kept = phases
    .filter(phase => phase.key !== 'review')
    .map(phase => ({
      ...phase,
      ...(phase.key === 'execute' ? { name: 'Shipping' } : {}),
      nextPhases: [
        ...(phase.nextPhases ?? []).filter(next => next !== 'review'),
        ...(phase.key === 'intake' ? ['parked', 'abandoned'] : []),
      ],
    }));
  return [
    kept[0]!,
    { key: 'parked', name: 'Parked', kind: 'resting', nextPhases: ['intake', 'planning'] },
    ...kept.slice(1),
    { key: 'abandoned', name: 'Abandoned', kind: 'terminal', nextPhases: [] },
  ];
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'an admin edited the stored Work board (%s)',
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

    async function edit(replica: Awaited<ReturnType<typeof boot>>, orgId: string, projectId: string) {
      const scope = { orgId, factoryProjectId: projectId };
      const work = (await replica.boards.get(scope, 'work'))!;
      await replica.boards.replace(
        scope,
        'work',
        { key: 'work', name: work.name, phases: editWork(work.phases) },
        { expectedRevision: work.revision, actor: 'admin-user', customized: true },
      );
    }

    async function catalogWork(replica: Awaited<ReturnType<typeof boot>>, projectId: string) {
      const catalog = await replica.send('GET', `/web/factory/projects/${projectId}/boards`);
      expect(catalog.status).toBe(200);
      return catalog.json.boards.find((board: { id: string }) => board.id === 'work');
    }

    async function createCard(replica: Awaited<ReturnType<typeof boot>>, projectId: string, title: string) {
      const created = await replica.send('POST', `/web/factory/projects/${projectId}/work-items`, {
        board: 'work',
        title,
      });
      expect(created.status).toBe(200);
      return created.json.workItem as { id: string; revision: number; stages: string[] };
    }

    function transition(
      replica: Awaited<ReturnType<typeof boot>>,
      projectId: string,
      card: { id: string; revision: number },
      stage: string,
    ) {
      return replica.send('POST', `/web/factory/projects/${projectId}/work-items/${card.id}/transition`, {
        board: 'work',
        stage,
        expectedRevision: card.revision,
        requestId: randomUUID(),
        cause: 'stored-board-test',
      });
    }

    it('serves the edit in the catalog, and moves cards by the edited phases', async () => {
      const requests = stubModel();
      const orgId = `org-${randomUUID()}`;
      const replica = await boot(database(), orgId);
      await replica.storage
        .getDomain<ModelCredentialsStorage>('model-credentials')
        .setCredential({ orgId }, 'openai', { type: 'api_key', key: 'sk-stored-boards-test' });
      const projectId = await createProject(replica, 'Edited project');
      const untouchedProjectId = await createProject(replica, 'Untouched project');
      const settings = await replica.send('PATCH', `/web/factory/projects/${projectId}`, {
        autoRunEnabled: true,
        defaultModelId: 'openai/gpt-5.6-sol',
      });
      expect(settings.status).toBe(200);
      const sourceControl = replica.github.sourceControlStorage;
      const installation = await sourceControl.installations.upsert({
        orgId,
        connectedByUserId: 'admin-user',
        externalId: '123',
      });
      const repository = await sourceControl.repositories.upsert({
        orgId,
        input: { installationId: installation.id, externalId: '456', slug: 'stored/project', defaultBranch: 'main' },
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
        sandboxWorkdir: '/tmp/stored-boards-runtime',
      });

      await edit(replica, orgId, projectId);

      // The edit was written behind the cache's back, so it arrives within the recheck window.
      await vi.waitFor(async () => expect((await catalogWork(replica, projectId)).phases.length).toBe(8), {
        timeout: 5_000,
      });
      const work = await catalogWork(replica, projectId);
      expect(work.phases.map((phase: { id: string; name: string }) => `${phase.id}:${phase.name}`)).toEqual([
        'intake:Intake',
        'parked:Parked',
        'triage:Triage',
        'planning:Planning',
        'execute:Shipping',
        'done:Done',
        'canceled:Canceled',
        'abandoned:Abandoned',
      ]);
      expect(work).toMatchObject({ source: 'builtin', customized: true });

      const card = await createCard(replica, projectId, 'Plan the stored boards');
      // Review was removed from the stored board, though the code board still declares it.
      const removed = await transition(replica, projectId, card, 'review');
      expect(removed.json.result).toMatchObject({ status: 'rejected' });
      expect(await replica.workItems.get({ orgId, id: card.id })).toMatchObject({ stages: ['intake'] });

      const parked = await transition(replica, projectId, card, 'parked');
      expect(parked.json.result).toMatchObject({ status: 'accepted', stage: 'parked' });

      const planning = await transition(replica, projectId, { id: card.id, revision: card.revision + 1 }, 'planning');
      expect(planning.json.result).toMatchObject({ status: 'accepted', stage: 'planning' });
      // Planning's code behavior reattached to the stored phase: the planning run reached the model.
      await vi.waitFor(
        () =>
          expect(requests.some(body => body.includes('Plan the stored boards') && body.includes('factory-plan'))).toBe(
            true,
          ),
        { timeout: 15_000 },
      );

      const untouched = await catalogWork(replica, untouchedProjectId);
      expect(untouched).toMatchObject({ source: 'builtin', customized: false });
      expect(untouched.phases.map((phase: { id: string; name: string }) => `${phase.id}:${phase.name}`)).toEqual([
        'intake:Intake',
        'triage:Triage',
        'planning:Planning',
        'execute:Building',
        'review:Review',
        'done:Done',
        'canceled:Canceled',
      ]);
    }, 30_000);

    it('treats a card in an added terminal phase as finished as soon as a restarted replica is up', async () => {
      stubModel();
      const orgId = `org-${randomUUID()}`;
      const newStorage = database();
      const first = await boot(newStorage, orgId);
      const projectId = await createProject(first, 'Restarted project');
      await edit(first, orgId, projectId);
      const { item: card } = await first.workItems.upsert({
        orgId,
        userId: 'admin-user',
        factoryProjectId: projectId,
        input: {
          board: 'work',
          title: 'Abandon me',
          claimKey: `claim-${randomUUID()}`,
          externalSource: { integrationId: 'github', type: 'issue', externalId: `issue-${randomUUID()}` },
        },
      });
      expect(card.claimKey).not.toBeNull();

      // A replica that just booted, moving the card the way a reconciler does: straight through storage,
      // with no request having loaded the project first.
      const restarted = await boot(newStorage, orgId);
      const moved = await restarted.workItems.update({
        orgId,
        id: card.id,
        userId: 'admin-user',
        patch: { stages: ['abandoned'] },
      });

      expect(moved?.item).toMatchObject({ stages: ['abandoned'], claimKey: null });
    }, 30_000);
  },
);
