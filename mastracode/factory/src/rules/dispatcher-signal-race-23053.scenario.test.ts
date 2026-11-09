/**
 * Scenario for #23053: a Factory run whose first attempt was aborted must be able
 * to recover on the dispatcher's retry, on the same binding and session.
 *
 * In production the retry's kickoff often lands while the session is still
 * finishing a run. `Session.sendSignal` read the session as busy, the run ended
 * before the agent routed the signal, and the agent woke the thread without the
 * session's request context. Mastra Code's model resolver needs that context, so
 * every retry died with "No model available" until the process restarted.
 *
 * This drives the real `FactoryDecisionDispatcher` against a real
 * `AgentController` session. The model is a gated `MastraLanguageModelV2Mock`
 * rather than aimock: the race needs a run that is provably in flight when the
 * session reads its state and provably over when the agent routes the kickoff,
 * which requires holding the provider stream open at an exact point.
 */
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { createLifecycleTestRegistry } from '../boards/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';

vi.setConfig({ testTimeout: 30_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const NO_MODEL = 'No model available: this run started without a controller session context';
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

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

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

async function mountFactory() {
  const firstAttempt = gate();
  const busyRun = gate();
  // One entry per model resolution (several per run): whether it saw the controller context.
  const modelResolutions: boolean[] = [];
  let streamCalls = 0;
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      streamCalls++;
      if (streamCalls === 1) return { stream: textStream('first attempt', firstAttempt.promise) };
      if (streamCalls === 2) return { stream: textStream('busy run', busyRun.promise) };
      return { stream: textStream('retry reply') };
    },
  });
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    // Mirrors Mastra Code's `getDynamicModel`: the model comes from the controller session.
    model: ({ requestContext }: { requestContext: RequestContext }) => {
      const hasController = requestContext.get('controller') !== undefined;
      modelResolutions.push(hasController);
      if (!hasController) throw new Error(NO_MODEL);
      return model;
    },
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
  const item = (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:23053' },
        title: 'Degraded session',
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    })
  ).item;
  const boards = createLifecycleTestRegistry({
    execute: {
      issue: {
        onEnter: () => ({
          type: 'invokeSkill',
          role: 'work',
          prompt: 'Work the card.',
          idempotencyKey: 'execute-23053',
        }),
      },
    },
  });
  const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
  const moved = await transitionService.transition({
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'system', id: 'factory-rule-dispatcher' },
    ingress: { type: 'rule', identity: 'move-23053' },
    cause: 'rule_decision',
  });
  expect(moved.status).toBe('accepted');
  await storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      id: item.id,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:23053' },
        title: 'Degraded session',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: session.identity.getId(), branch: 'factory/issue-23053', threadId },
    resourceId: PROJECT_ID,
    kickoffKey: 'kickoff-null',
    kickoffMessage: null,
  });

  const dispatcher = new FactoryDecisionDispatcher({
    controller,
    isAutoRunEnabled: async () => true,
    transitionService,
    storage,
    ownerId: 'worker-1',
  });

  const events: { type: string; reason?: string }[] = [];
  session.subscribe(event => {
    events.push(event as { type: string; reason?: string });
  });
  const count = (type: string) => events.filter(event => event.type === type).length;
  const lastEndReason = () => events.filter(event => event.type === 'agent_end').at(-1)?.reason;
  const decision = async () => (await storage.listDeferredDecisions('org-1', PROJECT_ID))[0];

  return {
    session,
    dispatcher,
    decision,
    count,
    lastEndReason,
    modelResolutions,
    streamCalls: () => streamCalls,
    firstAttempt,
    busyRun,
  };
}

describe('scenario: a Factory retry after an aborted attempt (#23053)', () => {
  it('resolves the session model and completes when the retry races the end of a busy run', async () => {
    const factory = await mountFactory();
    const { session, dispatcher } = factory;

    // Attempt 1: the kickoff wakes a run that is aborted before it finishes.
    const firstAttempt = dispatcher.runOnce(new Date('2030-01-01T00:00:00Z'));
    await waitFor(() => factory.streamCalls() === 1, 'the first attempt to reach the model');
    session.abort();
    factory.firstAttempt.release();
    await firstAttempt;
    const afterAbort = await factory.decision();
    expect(afterAbort).toMatchObject({ status: 'retry', attempts: 1, deliveryGeneration: 1 });
    expect(afterAbort?.lastError).toContain('aborted');
    expect(factory.modelResolutions.every(Boolean)).toBe(true);
    await waitFor(() => !session.run.isRunning(), 'the aborted run to reset');

    // The session is busy again (a follow-up on the same thread) when the retry comes due.
    void session.sendMessage({ content: 'follow-up while the card waits' }).catch(() => {});
    await waitFor(() => factory.streamCalls() === 2, 'the busy run to reach the model');
    expect(session.run.isRunning()).toBe(true);
    const busyRunEnds = factory.count('agent_end') + 1;

    // The session has already chosen how to route the retry's kickoff when it
    // prepares the thread subscription. Finish the busy run right there.
    const sendSignal = session.sendSignal.bind(session);
    const ensureSubscription = session.thread.ensureSubscription.bind(session.thread);
    let armed = false;
    let raced = false;
    vi.spyOn(session, 'sendSignal').mockImplementation((...args) => {
      if (args[0] && 'id' in args[0] && String(args[0].id).endsWith(':retry:1')) armed = true;
      return sendSignal(...args);
    });
    vi.spyOn(session.thread, 'ensureSubscription').mockImplementation(async (...args) => {
      if (armed && !raced) {
        raced = true;
        factory.busyRun.release();
        await waitFor(() => factory.count('agent_end') >= busyRunEnds, 'the busy run to end');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return ensureSubscription(...args);
    });

    // Attempt 2: the dispatcher's retry on the same binding and session.
    await dispatcher.runOnce(new Date('2030-01-01T00:01:00Z'));

    expect(raced).toBe(true);
    const retried = await factory.decision();
    expect(retried?.lastError ?? '').not.toContain('No model available');
    expect(retried).toMatchObject({ status: 'succeeded', attempts: 2 });
    expect(factory.modelResolutions).not.toContain(false);
    // The retry woke its own run: it reached the model with the session context and finished cleanly.
    await waitFor(() => factory.count('agent_end') === 3, 'the retry run to end');
    expect(factory.streamCalls()).toBe(3);
    expect(factory.count('agent_start')).toBe(3);
    expect(factory.count('error')).toBe(0);
    expect(factory.lastEndReason()).toBe('complete');
    expect(factory.modelResolutions).not.toContain(false);
  });
});
