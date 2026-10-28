import { randomUUID } from 'node:crypto';

import { Mastra } from '@mastra/core/mastra';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { defineBoard } from '../boards/index.js';
import { MastraFactory } from '../factory.js';
import { GithubIntegration } from '../integrations/github/integration.js';
import { mountApiRoutes } from '../routes/test-utils.js';
import { createFactorySecretEncryption } from '../secret-encryption.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
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
    return { exitCode: 0, stdout: command === 'pwd' ? '/home/test\n' : '', stderr: '' };
  }
}

const LOW_EFFORT: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
};

const ORG = 'phase-org';

/**
 * Cards enter Build by a board rule, not a person, so only the phase's start rule decides
 * whether their run starts. Build ends when its agent has listed the work items; the agent then
 * moves the card itself.
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
      onEnter: {
        issue: context => ({
          type: 'transition',
          idempotencyKey: `${context.ingress.id}:ship`,
          board: 'release',
          stage: 'build',
        }),
      },
    },
    build: {
      name: 'Build',
      kind: 'working',
      runner: { context: 'publisher', instructions: 'Keep it short.' },
      autoStart: true,
      autoStartWhen: LOW_EFFORT,
      exitTool: 'factory_list_work_items',
      nextPhases: ['done', 'backlog'],
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:publish`,
          role: 'publisher',
          prompt: `Publish ${context.item.title}.`,
        }),
      },
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

/**
 * A model that, asked to publish, runs `factory_list_work_items` and then moves the card with
 * `factory_transition_work_item` to the first phase the factory-phase signal offers.
 */
function fakeModel(requests: string[]) {
  const steps = new Map<string, number>();
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
    const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
    const text = JSON.stringify(JSON.parse(body).input);
    requests.push(text);
    const publish = text.match(/Publish (quick fix|large rewrite)\./)?.[1];
    const step = publish ? (steps.get(publish) ?? 0) : 2;
    if (publish && step < 2) {
      steps.set(publish, step + 1);
      const revision = [...text.matchAll(/expectedRevision (\d+)/g)].at(-1)?.[1];
      const next = text.match(/to one of: ([a-z-]+)/)?.[1];
      const item = {
        id: `fc_${step}`,
        type: 'function_call',
        call_id: `call_${publish.replace(/\W/g, '_')}_${step}`,
        name: step === 0 ? 'factory_list_work_items' : 'factory_transition_work_item',
        arguments: JSON.stringify(
          step === 0 ? {} : { stage: next, expectedRevision: Number(revision), rationale: 'Published.' },
        ),
      };
      return sse([
        { type: 'response.created', response: { id: `resp_${step}`, created_at: 1, model: 'phase-test' } },
        { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } },
        { type: 'response.function_call_arguments.delta', item_id: item.id, output_index: 0, delta: item.arguments },
        { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed' } },
        {
          type: 'response.completed',
          response: { id: `resp_${step}`, status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
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

describe('board phase fields at runtime', () => {
  it('starts a phase only for the cards its condition matches, and the agent moves the card after the exit tool', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-phase-test');
    const requests: string[] = [];
    fakeModel(requests);
    const storage = new LibSQLFactoryStorage({ id: 'phase-runtime', url: ':memory:' });
    const github = new GithubIntegration({
      appId: '123',
      privateKey: 'test-key',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      slug: 'phase-test',
    });
    const factory = new MastraFactory({
      storage,
      auth: null,
      integrations: [github],
      sandbox: () => new TestSandbox(),
      stateSecret: 'phase-runtime-test-state-secret',
      boards: [release],
      configVersion: 'phase-runtime-v1',
      secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
    });
    let mastra: Mastra | undefined;
    try {
      const args = await factory.prepare();
      mastra = new Mastra(args);
      await factory.finalize();
      const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
      app.use('*', async (c, next) => {
        c.set('factoryAuthUser', { workosId: 'phase-user', organizationId: ORG });
        await next();
      });
      mountApiRoutes(app, args.server?.apiRoutes ?? []);
      await storage
        .getDomain<ModelCredentialsStorage>('model-credentials')
        .setCredential({ orgId: ORG }, 'openai', { type: 'api_key', key: 'sk-phase-test' });
      const send = (method: string, path: string, body: unknown) =>
        app.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

      const { project } = await (await send('POST', '/web/factory/projects', { name: 'Phase project' })).json();
      // Project auto-run stays off: only the phase's own start rule may start runs.
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
      await sourceControl.projectRepositories.link({
        orgId: ORG,
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'phase-user',
        sandboxProvider: 'local',
        sandboxWorkdir: '/tmp/phase-runtime',
      });

      const workItems = storage.getDomain<WorkItemsStorage>('work-items');
      const card = async (title: string, labels: string[]): Promise<WorkItemRow> => {
        const response = await send('POST', `/web/factory/projects/${project.id}/work-items`, {
          board: 'release',
          title,
          externalSource: { integrationId: 'github', type: 'issue', externalId: `phase:${title}` },
          metadata: { authorTrusted: true, labels },
        });
        const created = await response.json();
        expect(created, JSON.stringify(created)).toMatchObject({ workItem: { board: 'release' } });
        return created.workItem as WorkItemRow;
      };
      const stagesOf = async (item: WorkItemRow) => (await workItems.get({ orgId: ORG, id: item.id }))?.stages;
      const decisionsFor = async (item: WorkItemRow) =>
        (await workItems.listDeferredDecisions(ORG, project.id)).filter(record => record.workItemId === item.id);

      const quick = await card('quick fix', ['effort:low']);
      const large = await card('large rewrite', ['effort:high']);

      // The low-effort card starts on its own and its run carries the phase instructions. The
      // factory-phase signal names the exit tool and where the card may go; after the exit tool
      // the agent moves the card with factory_transition_work_item.
      await vi.waitFor(async () => expect(await stagesOf(quick)).toEqual(['done']), { timeout: 15_000 });
      const publishRequest = requests.find(text => text.includes('Publish quick fix.'));
      expect(publishRequest).toContain('Keep it short.');
      expect(publishRequest).toContain(
        'This phase ends when factory_list_work_items succeeds. Then move the card with factory_transition_work_item to one of: done, backlog.',
      );

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
      expect(requests.some(text => text.includes('Publish large rewrite.'))).toBe(false);
    } finally {
      await mastra?.shutdown().catch(() => undefined);
      await factory.close?.().catch(() => undefined);
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  }, 60_000);
});
