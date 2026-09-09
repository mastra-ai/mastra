import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import type { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { modeThinkingLevelKey } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerRequestContext } from './types';

function createTextStreamModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

async function buildController(storage: InMemoryStore, sessionId = 'test-session') {
  // The dynamic model resolver may run more than once per stream; record the
  // distinct (mode, level) pairs the runs observed, in first-seen order.
  const seen: Array<{ modeId: string; packThinkingLevel: string | undefined }> = [];
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: ({ requestContext }: { requestContext: RequestContext }) => {
      const ctx = requestContext.get('controller') as AgentControllerRequestContext | undefined;
      const entry = { modeId: ctx?.session.modeId ?? '', packThinkingLevel: ctx?.session.packThinkingLevel };
      if (!seen.some(s => s.modeId === entry.modeId && s.packThinkingLevel === entry.packThinkingLevel)) {
        seen.push(entry);
      }
      return createTextStreamModel();
    },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [
      { id: 'build', agent, default: true, defaultModelId: 'mock/build' },
      { id: 'plan', agent, defaultModelId: 'mock/plan' },
    ],
  });
  await controller.init();
  const session = await controller.createSession({ id: sessionId, ownerId: 'test-owner' });
  await controller.getMastra()?.startWorkers();
  return { controller, session, seen };
}

describe('ModelPack thinking level in the request context', () => {
  it('is undefined when the thread has no pack thinking level for the mode', async () => {
    const { session, seen } = await buildController(new InMemoryStore());
    await session.thread.create();

    await session.sendMessage({ content: 'hello' });

    expect(seen).toEqual([{ modeId: 'build', packThinkingLevel: undefined }]);
  });

  it('exposes the persisted level for the current mode at run start', async () => {
    const { session, seen } = await buildController(new InMemoryStore());
    await session.thread.create();
    await session.thread.setSetting({ key: modeThinkingLevelKey('build'), value: 'high' });

    await session.sendMessage({ content: 'hello' });

    expect(seen).toEqual([{ modeId: 'build', packThinkingLevel: 'high' }]);
  });

  it('follows the active mode across a mode switch', async () => {
    const { session, seen } = await buildController(new InMemoryStore());
    await session.thread.create();
    await session.thread.setSetting({ key: modeThinkingLevelKey('build'), value: 'high' });
    await session.thread.setSetting({ key: modeThinkingLevelKey('plan'), value: 'low' });

    await session.mode.switch({ modeId: 'plan' });
    expect(session.model.getPackThinkingLevel()).toBe('low');
    await session.sendMessage({ content: 'hello' });

    await session.mode.switch({ modeId: 'build' });
    expect(session.model.getPackThinkingLevel()).toBe('high');
    await session.sendMessage({ content: 'hello' });

    expect(seen).toEqual([
      { modeId: 'plan', packThinkingLevel: 'low' },
      { modeId: 'build', packThinkingLevel: 'high' },
    ]);
  });

  it('hydrates from thread metadata when switching threads', async () => {
    const storage = new InMemoryStore();
    const { session } = await buildController(storage);
    const withPack = await session.thread.create();
    await session.thread.setSetting({ key: modeThinkingLevelKey('build'), value: 'max' });
    const withoutPack = await session.thread.create();
    expect(session.model.getPackThinkingLevel()).toBeUndefined();

    await session.thread.switch({ threadId: withPack.id });
    expect(session.model.getPackThinkingLevel()).toBe('max');

    await session.thread.switch({ threadId: withoutPack.id });
    expect(session.model.getPackThinkingLevel()).toBeUndefined();
  });

  it('picks up a level persisted by another session over the same thread', async () => {
    const storage = new InMemoryStore();
    const { session: a } = await buildController(storage, 'session-a');
    const thread = await a.thread.create();
    const { session: b, seen } = await buildController(storage, 'session-b');
    await b.thread.switch({ threadId: thread.id });
    expect(b.model.getPackThinkingLevel()).toBeUndefined();

    await a.thread.setSetting({ key: modeThinkingLevelKey('build'), value: 'medium' });
    await b.sendMessage({ content: 'hello' });

    expect(seen).toEqual([{ modeId: 'build', packThinkingLevel: 'medium' }]);
  });
});
