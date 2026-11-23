import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MessageHistory } from '@mastra/core/processors';
import type { Processor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { autoStartingBoards, commitDecisions, createLifecycleTestRegistry } from '../boards/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';

vi.setConfig({ testTimeout: 30_000 });

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SKILL_NAME = 'review-card';
const SKILL_RULE = 'Check every changed file against the card before approving.';
const T = new Date('2030-01-01T00:00:00Z');
const MINUTE = 60_000;
const at = (ms: number) => new Date(T.getTime() + ms);
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type ModelTurn = Error | 'tool-call';

function providerError(
  statusCode: number,
  message: string,
  fields: { responseHeaders?: Record<string, string>; responseBody: string },
) {
  return Object.assign(new Error(message), { name: 'AI_APICallError', statusCode, ...fields });
}

function rateLimited(retryAfterSeconds?: number) {
  return providerError(429, 'Rate limited', {
    ...(retryAfterSeconds === undefined ? {} : { responseHeaders: { 'retry-after': String(retryAfterSeconds) } }),
    responseBody: '{"type":"error","error":{"type":"rate_limit_error","message":"Rate limited"}}',
  });
}

function internalServerError() {
  return providerError(500, 'Internal server error', {
    responseBody: '{"type":"error","error":{"type":"api_error","message":"Internal server error"}}',
  });
}

function toolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-tool', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'tool-call', toolCallId: 'call-note', toolName: 'note', input: '{}' });
      controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage });
      controller.close();
    },
  });
}

let skillsRoot: string | undefined;

afterEach(() => {
  vi.useRealTimers();
  if (skillsRoot) rmSync(skillsRoot, { recursive: true, force: true });
  skillsRoot = undefined;
});

async function mountFactory() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T);
  skillsRoot = mkdtempSync(join(tmpdir(), 'factory-provider-limit-'));
  mkdirSync(join(skillsRoot, SKILL_NAME), { recursive: true });
  writeFileSync(
    join(skillsRoot, SKILL_NAME, 'SKILL.md'),
    `---\nname: ${SKILL_NAME}\ndescription: Review the card\n---\n\n${SKILL_RULE}\n`,
  );

  const turns: ModelTurn[] = [];
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      const turn = turns.shift();
      if (!turn) throw new Error('The model was called more often than the scenario scripted.');
      if (turn instanceof Error) throw turn;
      return { stream: toolCallStream() };
    },
  });
  const memoryStorage = new InMemoryStore();
  const memoryStore = await memoryStorage.getStore('memory');
  if (!memoryStore) throw new Error('The in-memory store has no memory domain.');
  const turnSavedWaiters: Array<() => void> = [];
  const savedTurns: Processor = {
    id: 'saved-turns',
    processOutputResult: ({ messages }) => {
      turnSavedWaiters.shift()?.();
      return messages;
    },
  };
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    model,
    // The provider's own retries are core's concern; each scripted turn is one model call.
    maxRetries: 0,
    tools: {
      note: createTool({
        id: 'note',
        description: 'Record a note about the card.',
        inputSchema: z.object({}),
        execute: async () => ({ noted: true }),
      }),
    },
    outputProcessors: [new MessageHistory({ storage: memoryStore }), savedTurns],
    memory: new MockMemory({ storage: memoryStorage }),
  });
  const mastra = new Mastra({ agents: { 'factory-agent': agent }, logger: false, storage: memoryStorage });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: [skillsRoot] }),
    id: 'code',
    storage: memoryStorage,
    modes: [{ id: 'build', name: 'Build', default: true, agent: mastra.getAgent('factory-agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'session-1', resourceId: PROJECT_ID, ownerId: 'user-1' });
  await session.thread.create();
  await session.state.set({ yolo: true });
  const threadId = session.thread.requireId();
  const sendSignal = vi.spyOn(session, 'sendSignal');
  const sentKickoffIds = () =>
    sendSignal.mock.calls.flatMap(([signal]) => ('id' in signal && typeof signal.id === 'string' ? [signal.id] : []));

  const storage = (await createFactoryStorageForTests()).workItems;
  const externalSource = { integrationId: 'github', type: 'issue', externalId: 'github-issue:429' };
  const item = (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: { externalSource, title: 'Rate-limited review', stages: ['intake'], sessions: {}, metadata: {} },
    })
  ).item;
  const boards = createLifecycleTestRegistry();
  const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
  await commitDecisions(storage, {
    factoryProjectId: PROJECT_ID,
    workItemId: item.id,
    stage: 'execute',
    ingress: 'move-429',
    decisions: [{ type: 'invokeSkill', role: 'work', skillName: SKILL_NAME, idempotencyKey: 'execute-429' }],
  });
  await storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      id: item.id,
      input: { externalSource, title: 'Rate-limited review', stages: ['execute'], sessions: {}, metadata: {} },
    },
    role: 'work',
    session: { sessionId: session.identity.getId(), branch: 'factory/issue-429', threadId },
    resourceId: PROJECT_ID,
    kickoffKey: 'kickoff-429',
    kickoffMessage: null,
  });

  const dispatcher = new FactoryDecisionDispatcher({
    controller,
    boards: autoStartingBoards(),
    transitionService,
    storage,
    ownerId: 'worker-1',
    staleBindingTtlMs: Number.MAX_SAFE_INTEGER,
  });
  return {
    attempt: async (time: Date, ...next: ModelTurn[]) => {
      const { promise: saved, resolve } = Promise.withResolvers<void>();
      turnSavedWaiters.push(resolve);
      vi.setSystemTime(time);
      turns.push(...next);
      await dispatcher.runOnce(new Date());
      await saved;
      expect(turns).toEqual([]);
      const [record] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
      if (!record) throw new Error('Expected the queued decision.');
      return record;
    },
    forgetEarlierKickoffs: () => memoryStore.deleteMessages(sentKickoffIds()),
    kickoff: (id: string) =>
      JSON.stringify(sendSignal.mock.calls.find(([signal]) => 'id' in signal && signal.id === id)?.[0]),
  };
}

describe('scenario: a Factory run that hits a provider limit', () => {
  it('waits for the provider without spending an attempt, then resumes the skill instead of sending it again', async () => {
    const factory = await mountFactory();

    const first = await factory.attempt(T, rateLimited(120));

    expect(first).toMatchObject({
      status: 'retry',
      failureCode: 'run_rate_limited',
      attempts: 0,
      availableAt: at(2 * MINUTE),
      rateLimitedSince: T,
      deliveryGeneration: 1,
    });

    const second = await factory.attempt(at(2 * MINUTE), rateLimited(120));

    expect(factory.kickoff(first.id)).toContain(SKILL_RULE);
    const resumed = factory.kickoff(`${first.id}:retry:1`);
    expect(resumed).toContain('Resume the active');
    expect(resumed).not.toContain(SKILL_RULE);
    expect(second).toMatchObject({
      status: 'retry',
      failureCode: 'run_rate_limited',
      attempts: 0,
      availableAt: at(4 * MINUTE),
      rateLimitedSince: T,
    });
  });

  it('retries once more at the end of the hour, then stops for a person', async () => {
    const factory = await mountFactory();

    await factory.attempt(T, rateLimited());
    const lastTry = await factory.attempt(at(55 * MINUTE), rateLimited());

    expect(lastTry).toMatchObject({
      status: 'retry',
      failureCode: 'run_rate_limited',
      attempts: 0,
      availableAt: at(60 * MINUTE),
    });

    const stopped = await factory.attempt(at(60 * MINUTE), rateLimited());

    expect(stopped).toMatchObject({ status: 'failed', failureCode: 'run_rate_limited' });
  });

  it('starts a fresh hour, and spends an attempt, when the retried run got model work done before the next rate limit', async () => {
    const factory = await mountFactory();

    await factory.attempt(T, rateLimited());
    const limitedAgain = await factory.attempt(at(61 * MINUTE), 'tool-call', rateLimited());

    expect(limitedAgain).toMatchObject({
      status: 'retry',
      failureCode: 'run_rate_limited',
      attempts: 1,
      availableAt: at(62 * MINUTE),
      rateLimitedSince: at(61 * MINUTE),
    });
  });

  it('stops for a person after five attempts when every resumed run gets work done and then hits the rate limit again', async () => {
    const factory = await mountFactory();

    for (const attempt of [1, 2, 3, 4]) {
      await expect(factory.attempt(at((attempt - 1) * MINUTE), 'tool-call', rateLimited())).resolves.toMatchObject({
        status: 'retry',
        failureCode: 'run_rate_limited',
        attempts: attempt,
      });
    }
    const stopped = await factory.attempt(at(4 * MINUTE), 'tool-call', rateLimited());

    expect(stopped).toMatchObject({ status: 'failed', failureCode: 'run_rate_limited', attempts: 5 });
  });

  it('closes the rate-limit window and spends an attempt on any other failure', async () => {
    const factory = await mountFactory();

    await factory.attempt(T, rateLimited());
    const failed = await factory.attempt(at(MINUTE), internalServerError());

    expect(failed).toMatchObject({
      status: 'retry',
      failureCode: 'run_failed',
      attempts: 1,
      rateLimitedSince: null,
    });
  });

  it('resumes the skill on a retry whose thread no longer holds the earlier kickoff', async () => {
    const factory = await mountFactory();

    const first = await factory.attempt(T, internalServerError());
    expect(first).toMatchObject({ status: 'retry', failureCode: 'run_failed', deliveryGeneration: 1 });

    await factory.forgetEarlierKickoffs();
    await factory.attempt(at(MINUTE), internalServerError());

    const resumed = factory.kickoff(`${first.id}:retry:1`);
    expect(resumed).toContain('Resume the active');
    expect(resumed).not.toContain(SKILL_RULE);
  });

  it('stops at once, without an automatic retry, when the provider account is out of quota', async () => {
    const factory = await mountFactory();

    const stopped = await factory.attempt(
      T,
      providerError(429, 'You exceeded your current quota', {
        responseBody:
          '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}',
      }),
    );

    expect(stopped).toMatchObject({ status: 'failed', failureCode: 'run_quota_exhausted', attempts: 1 });
  });
});
