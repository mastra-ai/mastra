/**
 * #27261 through a real Agent and LibSQL file storage: with the clock frozen, every user message
 * shares one millisecond, so turn one's observation cursor lands on the millisecond of the next
 * user message. The Observer must still observe it, exactly once.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

function textStream(text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: randomUUID(), modelId: 'mock', timestamp: new Date() },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
  ] as any[]);
}

// Mock models: aimock is not a dependency of the memory integration tests, and these models only
// record prompts and echo the codewords they were given.
function models() {
  const actorPrompts: string[] = [];
  const observerPrompts: string[] = [];
  const actor = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      actorPrompts.push(JSON.stringify(prompt));
      return { stream: textStream('Noted.'), rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
  const observer = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const serialized = JSON.stringify(prompt);
      observerPrompts.push(serialized);
      const words = [...new Set([...serialized.matchAll(/codeword-[a-z]+/g)].map(m => m[0]))];
      const lines = words.map(w => `- 🔴 User said ${w.replace('codeword-', 'observed-')}`).join('\n');
      return {
        stream: textStream(`<observations>\n## January 1, 2026\n${lines}\n</observations>`),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { actor, observer, actorPrompts, observerPrompts };
}

describe('observation cursor millisecond ties through an Agent (#27261)', () => {
  const directories: string[] = [];
  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true })));
  });

  it('observes a user message that shares the cursor millisecond exactly once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'om-cursor-tie-'));
    directories.push(directory);
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'tie.db')}` });
    await storage.init();
    const { actor, observer, actorPrompts, observerPrompts } = models();
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 20,
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: { model: observer, messageTokens: 1, bufferTokens: false },
          reflection: { model: observer, observationTokens: 100_000 },
        },
      },
    });
    const agent = new Agent({ id: 'tie-agent', name: 'tie-agent', instructions: 'Be brief.', model: actor, memory });
    const threadId = randomUUID();
    const resourceId = randomUUID();

    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-01T12:00:00.000Z') });
    for (const word of ['lisbon', 'rex', 'blue']) {
      await (
        await agent.stream(`Remember codeword-${word}.`, { memory: { thread: threadId, resource: resourceId } })
      ).consumeStream();
    }
    vi.useRealTimers();

    const record = await (await storage.getStore('memory'))!.getObservationalMemory(threadId, resourceId);
    const stored = (await memory.recall({ threadId, resourceId, perPage: false })).messages;
    console.info(
      `TIE_SCENARIO cursor=${record?.lastObservedAt ? new Date(record.lastObservedAt).toISOString() : null} ` +
        `observedIds=${record?.observedMessageIds?.length ?? 0} ` +
        `stored=${JSON.stringify(stored.map(m => `${m.role}@${new Date(m.createdAt).toISOString()}`))}\n` +
        `TIE_SCENARIO observations=${JSON.stringify(record?.activeObservations ?? '')}\n` +
        `TIE_SCENARIO observerCalls=${observerPrompts.length} lastActorPromptHasRex=${actorPrompts.at(-1)?.includes('rex')}`,
    );

    // Every user message shares turn one's millisecond, which is where turn one's observation leaves the cursor.
    expect(new Set(stored.filter(m => m.role === 'user').map(m => new Date(m.createdAt).getTime())).size).toBe(1);
    // "rex" (turn two) and "blue" (turn three) sit on that millisecond; each is observed exactly once.
    const observations = record?.activeObservations ?? '';
    expect(['lisbon', 'rex', 'blue'].map(word => observations.split(`observed-${word}`).length - 1)).toEqual([1, 1, 1]);
    // The actor's last prompt still carries "rex", raw or as an observation.
    expect(actorPrompts.at(-1)).toMatch(/observed-rex|codeword-rex/);
  });
});
