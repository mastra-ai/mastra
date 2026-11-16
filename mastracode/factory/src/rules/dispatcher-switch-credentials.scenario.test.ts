/**
 * Scenario: the dispatcher moves a bound session onto its card's thread before
 * delivering work. Switching subscribes to the thread, which loads memory, and
 * deployed memory resolves credentials for the signed-in user first. A switch
 * with no user fails with "the request has no authenticated user".
 *
 * Drives the real `FactoryDecisionDispatcher` against a real `AgentController`
 * with the tenant credential resolver registered, so the failure is the same
 * `getMemory → subscribeToThread → #switch → prepareCredentialTenant` chain
 * seen in production.
 */
import {
  resolveAuthenticatedCredentialTenant,
  withCredentialTenantPreparation,
} from '@mastra/code-sdk/agents/credential-resolver';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { autoStartingBoards, createTriageWorkRegistry } from '../boards/test-utils.js';
import {
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../routes/tenant-credentials.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';

vi.setConfig({ testTimeout: 30_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555557';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

afterEach(() => resetTenantCredentialResolverForTests());

async function setup() {
  const factory = await createFactoryStorageForTests();
  registerTenantCredentialResolver(factory.credentials, new Set(), resolveAuthenticatedCredentialTenant);

  const memoryStorage = new InMemoryStore();
  const memory = new MockMemory({ storage: memoryStorage });
  const memoryUsers: unknown[] = [];
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: new ReadableStream({
          start(c) {
            c.enqueue({ type: 'stream-start', warnings: [] });
            c.enqueue({ type: 'text-start', id: 't' });
            c.enqueue({ type: 'text-delta', id: 't', delta: 'ok' });
            c.enqueue({ type: 'text-end', id: 't' });
            c.enqueue({ type: 'finish', finishReason: 'stop', usage });
            c.close();
          },
        }),
      }),
    }),
    // Deployed memory resolves the caller's credentials before it loads.
    memory: withCredentialTenantPreparation(({ requestContext }) => {
      memoryUsers.push(requestContext.get('user'));
      return memory;
    }),
  });
  const mastra = new Mastra({ agents: { 'factory-agent': agent }, logger: false, storage: memoryStorage });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage: memoryStorage,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('factory-agent') }],
  });
  await controller.init();
  const owner = new RequestContext();
  owner.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  const session = await controller.createSession({
    id: 'session-1',
    resourceId: PROJECT_ID,
    ownerId: 'user-1',
    requestContext: owner,
  });
  // The card's thread, then a second thread the session is sitting on when work arrives.
  await session.thread.create({ requestContext: owner });
  const cardThreadId = session.thread.requireId();
  await session.thread.create({ requestContext: owner });
  expect(session.thread.requireId()).not.toBe(cardThreadId);

  const storage = factory.workItems;
  const source = { integrationId: 'github', type: 'issue' as const, externalId: 'github-issue:7' };
  const input = { externalSource: source, title: 'Issue 7', stages: ['execute'], sessions: {}, metadata: {} };
  const item = (await storage.upsert({ orgId: 'org-1', userId: 'user-1', factoryProjectId: PROJECT_ID, input })).item;
  await storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: { id: item.id, input },
    role: 'work',
    session: { sessionId: session.identity.getId(), branch: 'factory/issue-7', threadId: cardThreadId },
    resourceId: PROJECT_ID,
    kickoffKey: 'kickoff-null',
    kickoffMessage: null,
  });

  const dispatcher = new FactoryDecisionDispatcher({
    controller,
    boards: autoStartingBoards(createTriageWorkRegistry()),
    transitionService: new FactoryTransitionService({
      storage,
      configVersion: 'rules-v1',
      boards: createTriageWorkRegistry(),
    }),
    storage,
    intakeRoutes: factory.boards,
    ownerId: 'worker-1',
  });

  return { factory, storage, item, session, cardThreadId, dispatcher, memoryUsers };
}

describe('dispatcher thread switch credentials', () => {
  it('switches a bound session onto its card thread as the session owner', async () => {
    const { storage, item, session, cardThreadId, dispatcher, memoryUsers } = await setup();
    const card = await storage.get({ orgId: 'org-1', id: item.id });
    const now = new Date(Date.UTC(2030, 0, 1));
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'github:delivery-1', triggerType: 'github.issueCommentCreated' },
      configVersion: 'rules-v1',
      expectedRevision: card!.revision,
      actor: { type: 'github', login: 'contributor', trusted: false, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'signalActivity',
          idempotencyKey: 'github:delivery-1:activity',
          event: 'work_item.commented',
          reference: 'acme/repo#7',
          url: 'https://github.com/acme/repo/issues/7#issuecomment-1',
          author: 'contributor',
          authorTrusted: false,
        },
      ],
      causalChain: [],
      now,
    });
    memoryUsers.length = 0;
    await dispatcher.runOnce(now);

    const decisions = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(decisions.map(d => ({ status: d.status, lastError: d.lastError }))).toEqual([
      { status: 'succeeded', lastError: null },
    ]);
    expect(session.thread.requireId()).toBe(cardThreadId);
    expect(memoryUsers[0]).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });

  it('moves a card by intake route after switching its bound session as the session owner', async () => {
    const { factory, storage, item, session, cardThreadId, dispatcher, memoryUsers } = await setup();
    const scope = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
    for (const seeded of (await factory.boards.listIntakeRoutes(scope)).reverse()) {
      await factory.boards.deleteIntakeRoute(scope, seeded.id, { expectedRevision: seeded.revision });
    }
    await factory.boards.createIntakeRoute(
      scope,
      { name: 'Closed', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: 'triage' } },
      'admin',
    );
    const card = await storage.get({ orgId: 'org-1', id: item.id });
    const now = new Date(Date.UTC(2030, 0, 1));
    await storage.commitRuleEvaluation({
      ...scope,
      workItemId: item.id,
      ingress: { identity: 'github:delivery-2', triggerType: 'github.issueClosed' },
      configVersion: 'rules-v1',
      expectedRevision: card!.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'routeEvent',
          idempotencyKey: 'github:delivery-2:event-route',
          event: { type: 'work_item.closed', reason: 'completed' },
        },
      ],
      causalChain: [],
      now,
    });
    memoryUsers.length = 0;
    await dispatcher.runOnce(now);

    const routed = (await storage.listDeferredDecisions('org-1', PROJECT_ID)).find(
      d => d.decision.type === 'routeEvent',
    );
    expect(routed).toMatchObject({ status: 'succeeded', lastError: null });
    expect(await storage.get({ orgId: 'org-1', id: item.id })).toMatchObject({ stages: ['triage'] });
    expect(session.thread.requireId()).toBe(cardThreadId);
    expect(memoryUsers[0]).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });
});
