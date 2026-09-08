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
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

class ReleaseSandbox extends MastraSandbox {
  readonly id = randomUUID();
  readonly name = 'Release test sandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'Release test sandbox' });
  }

  async executeCommand(command: string) {
    return { exitCode: 0, stdout: command === 'pwd' ? '/home/test\n' : '', stderr: '' };
  }
}

const release = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  transitionPolicy: context => {
    if (context.toStage === 'preparing' && (!context.isHumanTransition || context.cause !== 'release-approved')) {
      return {
        type: 'reject',
        code: 'approval_required',
        reason: 'A maintainer must explicitly approve this release.',
      };
    }
  },
  tools: {
    execute_command: {
      onResult: context => {
        if (context.item.stages[0] !== 'shipping' || context.result.status !== 'success') return;
        return {
          type: 'transition',
          idempotencyKey: `${context.ingress.id}:published`,
          board: 'release',
          stage: 'shipped',
        };
      },
    },
  },
  phases: {
    queued: {
      title: 'Queued',
      kind: 'resting',
      next: 'preparing',
      onEnter: {
        issue: context => {
          if (context.item.parentWorkItemId) return;
          return {
            type: 'upsertLinkedWorkItem',
            idempotencyKey: `${context.ingress.id}:release-child`,
            board: 'release',
            stage: 'queued',
            source: 'github-issue',
            sourceKey: 'release:43',
            title: 'Publish linked release',
            url: null,
          };
        },
      },
    },
    preparing: {
      title: 'Preparing',
      kind: 'working',
      role: 'release-preparer',
      next: 'shipping',
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:prepare`,
          role: 'release-preparer',
          prompt: 'Prepare the release and transition to shipping.',
        }),
      },
    },
    shipping: {
      title: 'Shipping',
      kind: 'working',
      role: 'release-publisher',
      next: 'shipped',
      onEnter: {
        issue: context => ({
          type: 'invokeSkill',
          idempotencyKey: `${context.ingress.id}:publish`,
          role: 'release-publisher',
          prompt: 'Publish the release.',
        }),
      },
    },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
});

describe('custom board public runtime', () => {
  it.each([true, false])(
    'executes a lifecycle-linked release through both roles and terminal tool-result dispatch (includeDefaultBoards: %s)',
    async includeDefaultBoards => {
      const phaseRequests: string[] = [];
      let handoffRequested = false;
      let publishRequested = false;
      const model = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.endsWith('/responses')) throw new Error(`Unexpected external request: ${url}`);
        const body = input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
        const phaseText = JSON.stringify(JSON.parse(body).input);
        phaseRequests.push(phaseText);
        const currentRevision = [
          ...phaseText.matchAll(/Use factory_transition_work_item with expectedRevision (\d+)/g),
        ].at(-1)?.[1];
        const publishing = handoffRequested && !publishRequested && phaseText.includes('Role: release-publisher');
        if (publishing || (!handoffRequested && phaseText.includes('Role: release-preparer'))) {
          if (!publishing && currentRevision === undefined) throw new Error('Missing Factory phase expectedRevision.');
          if (publishing) publishRequested = true;
          else handoffRequested = true;
          const item = {
            id: publishing ? 'fc_publish' : 'fc_release',
            type: 'function_call',
            call_id: publishing ? 'call_publish' : 'call_release_handoff',
            name: publishing ? 'execute_command' : 'factory_transition_work_item',
            arguments: JSON.stringify(
              publishing
                ? { command: 'echo published' }
                : { stage: 'shipping', expectedRevision: Number(currentRevision), rationale: 'Release prepared.' },
            ),
          };
          const events = [
            { type: 'response.created', response: { id: 'resp_handoff', created_at: 1, model: 'release-test' } },
            { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '' } },
            {
              type: 'response.function_call_arguments.delta',
              item_id: item.id,
              output_index: 0,
              delta: item.arguments,
            },
            { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed' } },
            {
              type: 'response.completed',
              response: { id: 'resp_handoff', status: 'completed', usage: { input_tokens: 1, output_tokens: 1 } },
            },
          ];
          return new Response(
            events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''),
            {
              headers: { 'content-type': 'text/event-stream' },
            },
          );
        }
        const item = { id: 'msg_release', type: 'message', role: 'assistant', content: [] };
        const events = [
          { type: 'response.created', response: { id: 'resp_release', created_at: 1, model: 'release-test' } },
          { type: 'response.output_item.added', output_index: 0, item },
          {
            type: 'response.output_text.delta',
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            delta: 'Release phase acknowledged.',
          },
          { type: 'response.output_item.done', output_index: 0, item },
          {
            type: 'response.completed',
            response: {
              id: 'resp_release',
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
      const storage = new LibSQLFactoryStorage({ id: 'custom-runtime', url: ':memory:' });
      const github = new GithubIntegration({
        appId: '123',
        privateKey: 'test-key',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        slug: 'release-test',
      });
      const factory = new MastraFactory({
        storage,
        auth: null,
        integrations: [github],
        sandbox: () => new ReleaseSandbox(),
        stateSecret: 'release-runtime-test-state-secret',
        boards: [release],
        configVersion: 'release-runtime-v1',
        includeDefaultBoards,
        secretEncryption: createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } }),
      });
      let mastra: Mastra | undefined;
      try {
        const args = await factory.prepare();
        mastra = new Mastra(args);
        await factory.finalize();
        const app = new Hono<{ Variables: { factoryAuthUser: { workosId: string; organizationId: string } } }>();
        app.use('*', async (c, next) => {
          c.set('factoryAuthUser', { workosId: 'release-user', organizationId: 'release-org' });
          await next();
        });
        mountApiRoutes(app, args.server?.apiRoutes ?? []);
        await storage
          .getDomain<ModelCredentialsStorage>('model-credentials')
          .setCredential({ orgId: 'release-org' }, 'openai', { type: 'api_key', key: 'sk-release-test' });
        const post = (path: string, body: unknown) =>
          app.request(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
        const projectResponse = await post('/web/factory/projects', { name: 'Release project' });
        expect(projectResponse.status).toBe(201);
        const { project } = await projectResponse.json();
        const settingsResponse = await app.request(`/web/factory/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ autoRunEnabled: true }),
        });
        expect(settingsResponse.status).toBe(200);
        const sourceControl = github.sourceControlStorage;
        const installation = await sourceControl.installations.upsert({
          orgId: 'release-org',
          connectedByUserId: 'release-user',
          externalId: '123',
        });
        const repository = await sourceControl.repositories.upsert({
          orgId: 'release-org',
          input: { installationId: installation.id, externalId: '456', slug: 'release/project', defaultBranch: 'main' },
        });
        const connection = await sourceControl.connections.create({
          orgId: 'release-org',
          factoryProjectId: project.id,
          installationId: installation.id,
          createdByUserId: 'release-user',
        });
        await sourceControl.projectRepositories.link({
          orgId: 'release-org',
          connectionId: connection.id,
          repositoryId: repository.id,
          createdByUserId: 'release-user',
          sandboxProvider: 'local',
          sandboxWorkdir: '/tmp/release-runtime',
        });
        const itemResponse = await post(`/web/factory/projects/${project.id}/work-items`, {
          board: 'release',
          title: 'Publish release',
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'release:42' },
        });
        expect(await itemResponse.clone().json()).toMatchObject({ workItem: { board: 'release', stages: ['queued'] } });
        expect(itemResponse.status).toBe(200);
        const { workItem: parent } = await itemResponse.json();
        const workItems = storage.getDomain<WorkItemsStorage>('work-items');
        const listChildren = async () =>
          (await workItems.list({ orgId: 'release-org', factoryProjectId: project.id })).filter(
            item => item.parentWorkItemId === parent.id,
          );
        await vi.waitFor(async () => expect(await listChildren()).toHaveLength(1), { timeout: 10_000 });
        const [workItem] = await listChildren();
        expect(workItem).toMatchObject({
          board: 'release',
          stages: ['queued'],
          parentWorkItemId: parent.id,
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'release:43' },
        });
        const transitionPath = `/web/factory/projects/${project.id}/work-items/${workItem.id}/transition`;
        const denied = await post(transitionPath, {
          board: 'release',
          stage: 'preparing',
          expectedRevision: workItem.revision,
          requestId: randomUUID(),
          cause: 'release-draft',
        });
        expect(await denied.json()).toMatchObject({ result: { status: 'rejected', code: 'approval_required' } });
        expect(await workItems.get({ orgId: 'release-org', id: workItem.id })).toMatchObject({
          stages: ['queued'],
          revision: workItem.revision,
        });
        expect(await workItems.listRunBindings('release-org', project.id, workItem.id)).toEqual([]);
        const approvedRequest = {
          board: 'release',
          stage: 'preparing',
          expectedRevision: workItem.revision,
          requestId: randomUUID(),
          cause: 'release-approved',
        };
        const response = await post(transitionPath, approvedRequest);
        const { result } = await response.json();
        expect(result).toMatchObject({ status: 'accepted', stage: 'preparing', revision: workItem.revision + 1 });
        await vi.waitFor(
          async () => {
            expect(
              await workItems.listRunBindings('release-org', project.id, workItem.id),
              JSON.stringify(await workItems.listDeferredDecisions('release-org', project.id)),
            ).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'release-publisher' })]));
          },
          { timeout: 10_000 },
        );
        await vi.waitFor(
          async () => {
            const decisions = await workItems.listDeferredDecisions('release-org', project.id);
            expect(decisions.filter(record => record.decision.type === 'invokeSkill')).not.toHaveLength(0);
            expect(decisions.every(record => record.status === 'succeeded')).toBe(true);
          },
          { timeout: 10_000 },
        );
        await vi.waitFor(() => expect(model).toHaveBeenCalled(), { timeout: 10_000 });
        expect(publishRequested).toBe(true);
        await vi.waitFor(
          async () => {
            expect(
              await workItems.get({ orgId: 'release-org', id: workItem.id }),
              JSON.stringify(await workItems.listDeferredDecisions('release-org', project.id)),
            ).toMatchObject({ board: 'release', stages: ['shipped'] });
            expect(
              (await workItems.listRunBindings('release-org', project.id, workItem.id)).every(
                binding => binding.status === 'revoked',
              ),
            ).toBe(true);
          },
          { timeout: 10_000 },
        );
        expect(handoffRequested).toBe(true);
        expect(publishRequested).toBe(true);
        for (const [stage, role] of [
          ['preparing', 'release-preparer'],
          ['shipping', 'release-publisher'],
        ]) {
          expect(
            phaseRequests.some(
              text =>
                text.includes(`(${stage})`) &&
                text.includes(`Role: ${role}`) &&
                text.includes('Factory release phase:') &&
                text.includes('Config: release-runtime-v1') &&
                text.includes(workItem.id),
            ),
          ).toBe(true);
        }
        const bindings = await workItems.listRunBindings('release-org', project.id, workItem.id);
        expect(bindings.map(binding => binding.role).sort()).toEqual(['release-preparer', 'release-publisher']);
        const publisher = bindings.find(binding => binding.role === 'release-publisher')!;
        const cursor = await workItems.getToolResultCursor('release-org', project.id, publisher.id);
        expect(cursor).toMatchObject({ bindingId: publisher.id, lastMessageId: expect.any(String) });
        const decisions = await workItems.listDeferredDecisions('release-org', project.id);
        expect(decisions.map(record => record.decision.type).sort()).toEqual([
          'invokeSkill',
          'invokeSkill',
          'transition',
          'upsertLinkedWorkItem',
        ]);
        expect(decisions.find(record => record.decision.type === 'transition')).toMatchObject({
          status: 'succeeded',
          decision: { board: 'release', stage: 'shipped' },
        });
        const evaluations = await storage.ops.findMany('factory_rule_evaluations', {});
        expect(evaluations.length).toBeGreaterThan(0);
        expect(evaluations.every(row => row.rule_set_version === 'release-runtime-v1')).toBe(true);
        expect(evaluations.filter(row => row.code === 'approval_required')).toHaveLength(1);
        const toolIngresses = await storage.ops.findMany('factory_rule_ingress', { trigger_type: 'tool.result' });
        expect(toolIngresses).toHaveLength(1);
        expect(evaluations.filter(row => row.ingress_id === toolIngresses[0]!.id)).toHaveLength(1);
        const terminal = await workItems.get({ orgId: 'release-org', id: workItem.id });
        expect(terminal?.revision).toBeGreaterThan(workItem.revision + 2);
        const replay = await post(transitionPath, approvedRequest);
        expect(await replay.json()).toMatchObject({ result });
        expect(await workItems.get({ orgId: 'release-org', id: workItem.id })).toEqual(terminal);
        expect(await listChildren()).toHaveLength(1);
        expect(await workItems.listDeferredDecisions('release-org', project.id)).toEqual(decisions);
        expect(await storage.ops.findMany('factory_rule_evaluations', {})).toEqual(evaluations);
        expect(await workItems.getToolResultCursor('release-org', project.id, publisher.id)).toEqual(cursor);
      } finally {
        await factory.shutdown();
        await mastra?.stopWorkers();
        await storage.close();
        model.mockRestore();
      }
    },
    30_000,
  );
});
