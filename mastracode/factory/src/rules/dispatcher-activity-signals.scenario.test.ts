/**
 * Scenario: comments and edits on a card's source reach the card's session as
 * pointers only.
 *
 * This drives the real `FactoryDecisionDispatcher` against a real
 * `AgentController` session and real notification storage, so the assertions
 * cover what the agent is actually prompted with and what core keeps pending
 * while the session is busy. The model is a gated `MastraLanguageModelV2Mock`
 * because the busy case needs a run that is provably in flight while the
 * comments arrive.
 */
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/registry.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';
import type { FactorySignalActivityDecision } from './types.js';

vi.setConfig({ testTimeout: 30_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555556';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const COMMENT_URL = 'https://github.com/acme/repo/issues/42#issuecomment-100';

function textStream(delta: string, gate?: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta });
      await gate;
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

function waitFor(check: () => boolean, label: string, timeoutMs = 10_000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`timed out waiting for ${label}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

async function mountFactory({ bound = true }: { bound?: boolean } = {}) {
  let releaseBusyRun!: () => void;
  const busyRun = new Promise<void>(resolve => {
    releaseBusyRun = resolve;
  });
  let holdNextRun = false;
  const prompts: string[] = [];
  const model = new MastraLanguageModelV2Mock({
    doStream: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      if (holdNextRun) {
        holdNextRun = false;
        return { stream: textStream('busy', busyRun) };
      }
      return { stream: textStream('noted') };
    },
  });
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    model,
  });
  const memoryStorage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'factory-agent': agent }, logger: false, storage: memoryStorage });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage: memoryStorage,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('factory-agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'session-1', resourceId: PROJECT_ID, ownerId: 'user-1' });
  await session.thread.create();
  const threadId = session.thread.requireId();

  const storage = (await createFactoryStorageForTests()).workItems;
  const source = { integrationId: 'github', type: 'issue' as const, externalId: 'github-issue:42' };
  const item = (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: { externalSource: source, title: 'Issue 42', stages: ['execute'], sessions: {}, metadata: {} },
    })
  ).item;
  if (bound) {
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: item.id,
        input: { externalSource: source, title: 'Issue 42', stages: ['execute'], sessions: {}, metadata: {} },
      },
      role: 'work',
      session: { sessionId: session.identity.getId(), branch: 'factory/issue-42', threadId },
      resourceId: PROJECT_ID,
      kickoffKey: 'kickoff-null',
      kickoffMessage: null,
    });
  }

  const boards = createBoardRegistry();
  const dispatcher = new FactoryDecisionDispatcher({
    controller,
    isAutoRunEnabled: async () => true,
    transitionService: new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards }),
    storage,
    ownerId: 'worker-1',
  });

  const events: { type: string }[] = [];
  session.subscribe(event => {
    events.push(event as { type: string });
  });
  const agentEnds = () => events.filter(event => event.type === 'agent_end').length;

  let deliveries = 0;
  const now = () => new Date(Date.UTC(2030, 0, 1, 0, 0, deliveries));
  /** Commits a signal the way the GitHub rules ingress does for a comment, then dispatches it. */
  const signal = async (decision: Partial<FactorySignalActivityDecision> = {}) => {
    deliveries += 1;
    const card = await storage.get({ orgId: 'org-1', id: item.id });
    await storage.commitRuleEvaluation({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: `github:delivery-${deliveries}`, triggerType: 'github.issueCommentCreated' },
      configVersion: 'rules-v1',
      expectedRevision: card!.revision,
      actor: { type: 'github', login: 'contributor', trusted: false, factoryAuthored: false },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'signalActivity',
          idempotencyKey: `github:delivery-${deliveries}:activity`,
          event: 'work_item.commented',
          reference: 'acme/repo#42',
          url: COMMENT_URL,
          author: 'contributor',
          authorTrusted: false,
          ...decision,
        },
      ],
      causalChain: [],
      now: now(),
    });
    await dispatcher.runOnce(now());
  };
  const notifications = async () => {
    const store = await memoryStorage.getStore('notifications');
    return store!.listNotifications({ threadId, source: 'factory' });
  };
  const decisions = () => storage.listDeferredDecisions('org-1', PROJECT_ID);

  return {
    session,
    item,
    signal,
    notifications,
    decisions,
    prompts,
    agentEnds,
    holdNextRun: () => {
      holdNextRun = true;
    },
    releaseBusyRun: () => releaseBusyRun(),
  };
}

describe('scenario: source activity reaches the card session as pointers', () => {
  it('wakes an idle session with who commented and where, marked untrusted, and nothing they wrote', async () => {
    const factory = await mountFactory();

    await factory.signal();
    await waitFor(() => factory.agentEnds() === 1, 'the woken run to end');

    const [record] = await factory.notifications();
    expect(record).toMatchObject({
      kind: 'source-activity',
      summary: `New comment by @contributor (untrusted author) on acme/repo#42: ${COMMENT_URL}`,
    });
    // The agent was prompted with the pointer.
    expect(factory.prompts.at(-1)).toContain(COMMENT_URL);
    expect(factory.prompts.at(-1)).toContain('@contributor (untrusted author)');
    expect((await factory.decisions()).map(entry => entry.status)).toEqual(['succeeded']);
  });

  it('keeps comments that arrive while the session is busy as one pending notification that counts them', async () => {
    const factory = await mountFactory();
    factory.holdNextRun();
    void factory.session.sendMessage({ content: 'keep working' }).catch(() => {});
    await waitFor(() => factory.prompts.length === 1, 'the busy run to reach the model');
    expect(factory.session.run.isRunning()).toBe(true);

    await factory.signal();
    await factory.signal({ author: 'maintainer', authorTrusted: true });

    const records = await factory.notifications();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'source-activity',
      status: 'pending',
      coalescedCount: 2,
      summary: `New comment by @maintainer on acme/repo#42: ${COMMENT_URL}`,
    });
    expect((await factory.decisions()).map(entry => entry.status)).toEqual(['succeeded', 'succeeded']);
    // Nothing reached the busy run's model call.
    expect(factory.prompts).toHaveLength(1);

    factory.releaseBusyRun();
    await waitFor(() => factory.agentEnds() >= 1, 'the busy run to end');
  });

  it('drops activity on a card nobody is working, without failing or retrying', async () => {
    const factory = await mountFactory({ bound: false });

    await factory.signal();

    expect(await factory.notifications()).toEqual([]);
    expect(await factory.decisions()).toEqual([expect.objectContaining({ status: 'succeeded', attempts: 1 })]);
    expect(factory.prompts).toEqual([]);
  });
});
