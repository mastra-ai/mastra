import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../../../index';

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

const GROUP_COUNT = 6;
const BULLETS_PER_GROUP = 5;

function groupedObservations(): string {
  return Array.from({ length: GROUP_COUNT }, (_, g) =>
    [
      `<observation-group id="g${g}" range="m${g * 2}:m${g * 2 + 1}">`,
      ...Array.from({ length: BULLETS_PER_GROUP }, (_, b) => `* group ${g} fact ${b}`),
      '</observation-group>',
    ].join('\n'),
  ).join('\n');
}

function plainObservations(): string {
  return Array.from({ length: GROUP_COUNT * (BULLETS_PER_GROUP + 2) }, (_, i) => `* fact ${i}`).join('\n');
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function runBufferedReflection(observations: string) {
  mock.on({ endpoint: 'chat' }, { content: '<observations>\n* Reflected summary\n</observations>' });

  const openai = createOpenAI({ apiKey: 'test', baseURL: `${mock.url}/v1` });
  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        scope: 'thread',
        retrieval: true,
        observation: { model: openai.chat('observer'), messageTokens: 30_000 },
        reflection: { model: openai.chat('reflector'), observationTokens: 200, bufferActivation: 0.5 },
      },
    },
  });
  const memoryStore = (await store.getStore('memory'))!;
  const engine = (await memory.omEngine)!;

  const record = await memoryStore.initializeObservationalMemory({
    threadId: 'thread-1',
    resourceId: 'resource-1',
    scope: 'thread',
    config: {},
  });
  const lineCount = observations.split('\n').length;
  await memoryStore.updateActiveObservations({
    id: record.id,
    observations,
    tokenCount: lineCount * 10,
    lastObservedAt: new Date(),
  });
  const seeded = (await memoryStore.getObservationalMemory('thread-1', 'resource-1'))!;

  await (engine.reflector as any).doAsyncBufferedReflection(
    seeded,
    'thread-1:resource-1',
    undefined,
    new RequestContext(),
  );

  const buffered = (await memoryStore.getObservationalMemory('thread-1', 'resource-1'))!;
  // Read before the swap: the in-memory adapter clears these fields on the stored record.
  const reflectedLineCount = buffered.reflectedObservationLineCount;
  const activated = await memoryStore.swapBufferedReflectionToActive({ currentRecord: buffered, tokenCount: 100 });

  return {
    reflectedLineCount,
    activeObservations: activated.activeObservations,
    reflectorCalls: mock.getRequests().length,
  };
}

describe('buffered reflection cut on observation groups (#28445)', () => {
  it('cuts after a whole observation group so activation keeps tags balanced', async () => {
    const { reflectedLineCount, activeObservations, reflectorCalls } =
      await runBufferedReflection(groupedObservations());

    expect(reflectorCalls).toBeGreaterThan(0);
    // 42 lines at 10 tokens each; the 100-token activation point estimates 10 lines,
    // which lands inside g1. The cut must move back to the end of g0.
    expect(reflectedLineCount).toBe(BULLETS_PER_GROUP + 2);
    expect(count(activeObservations, '<observation-group')).toBe(count(activeObservations, '</observation-group>'));
    expect(activeObservations).toContain('<observation-group id="g1" range="m2:m3">\n* group 1 fact 0');
    expect(activeObservations).not.toContain('group 0 fact');
  });

  it('keeps the estimated cut for observations without group tags', async () => {
    const { reflectedLineCount } = await runBufferedReflection(plainObservations());

    expect(reflectedLineCount).toBe(10);
  });
});
