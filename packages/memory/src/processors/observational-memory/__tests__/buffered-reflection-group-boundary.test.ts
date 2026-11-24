import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { parseObservationGroups } from '../observation-groups';

// Buffered (async) reflection reflects a prefix of the active observations, measured in lines.
// With retrieval on, observations are wrapped in <observation-group> tags, and a cut that lands
// inside a group used to send the group's opening tag to the reflector while its remaining bullets
// and closing tag stayed active with no opening tag. The agent then saw a stray
// </observation-group>, and the tail bullets lost the range recall needs. (#28445)

const GROUP_COUNT = 6;
const BULLETS_PER_GROUP = 5;

function group(i: number) {
  return [
    `<observation-group id="g${i}" range="m${i}a:m${i}b">`,
    ...Array.from({ length: BULLETS_PER_GROUP }, (_, b) => `* group ${i} observation ${b}`),
    '</observation-group>',
  ].join('\n');
}

function groupedObservations() {
  return Array.from({ length: GROUP_COUNT }, (_, i) => group(i)).join('\n\n');
}

function countTags(observations: string) {
  return {
    opens: (observations.match(/<observation-group\s/g) ?? []).length,
    closes: (observations.match(/<\/observation-group>/g) ?? []).length,
  };
}

function createReflector(prompts: string[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      // Keep only what the reflector was asked to reflect on, not the system instructions.
      prompts.push(JSON.stringify(prompt.filter(message => message.role === 'user')));
      return {
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: '<observations>\n* Reflected summary\n</observations>' },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 } },
        ]),
      };
    },
  });
}

async function prepareTurn(memory: Memory, threadId: string, resourceId: string) {
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const turn = om.beginTurn({ threadId, resourceId, messageList: new MessageList({ threadId, resourceId }) });
  await turn.start(memory);
  await turn.step(0).prepare();
  await om.settled();
  return om;
}

/**
 * Seeds `observations` as the active observations at 800 tokens (between the 500-token buffering
 * point and the 1000-token reflection threshold) and lets a turn buffer a reflection. Then grows the
 * observations past the reflection threshold so the next turn activates it. Returns the reflector
 * inputs, the stored cut, and the observations after activation.
 */
async function bufferAndActivate(observations: string, options: { retrieval: boolean }) {
  const prompts: string[] = [];
  const reflector = createReflector(prompts);
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: {
      semanticRecall: false,
      observationalMemory: {
        scope: 'thread',
        retrieval: options.retrieval,
        observation: { model: reflector, messageTokens: 30_000 },
        reflection: { model: reflector, observationTokens: 1000, bufferActivation: 0.5 },
      },
    },
  });
  const threadId = randomUUID();
  const resourceId = randomUUID();
  await memory.createThread({ threadId, resourceId });
  const om = await memory.omEngine;
  if (!om) throw new Error('OM must be enabled');
  const store = await storage.getStore('memory');
  if (!store) throw new Error('Memory store must exist');

  const record = await om.getOrCreateRecord(threadId, resourceId);
  await store.updateActiveObservations({
    id: record.id,
    observations,
    tokenCount: 800,
    lastObservedAt: new Date(),
  });

  await prepareTurn(memory, threadId, resourceId);
  const buffered = await om.getRecord(threadId, resourceId);
  if (!buffered?.bufferedReflection) throw new Error('Expected a buffered reflection');
  const cut = buffered.reflectedObservationLineCount;

  // A new observation lands after buffering and pushes the record past the reflection threshold.
  await store.updateActiveObservations({
    id: buffered.id,
    observations: `${buffered.activeObservations}\n\n* later observation`,
    tokenCount: 1100,
    lastObservedAt: new Date(),
  });
  await prepareTurn(memory, threadId, resourceId);
  const activated = await om.getRecord(threadId, resourceId);
  if (!activated || activated.id === buffered.id) throw new Error('Expected the buffered reflection to activate');

  return { prompts, cut, activeObservations: activated.activeObservations };
}

describe('buffered reflection with observation groups (#28445)', () => {
  it('keeps every observation group whole across a buffered reflection', async () => {
    // Six 7-line groups separated by blank lines: 47 lines. At 800 / 47 ≈ 17 tokens per line the
    // 500-token activation point is a raw cut of floor(500 / 17.02) = 29 lines, inside g3 (lines 24-30).
    const observations = groupedObservations();
    const { prompts, cut, activeObservations } = await bufferAndActivate(observations, {
      retrieval: true,
    });

    // The reflector saw g0-g2 whole and nothing of g3.
    expect(prompts).toHaveLength(1);
    for (const i of [0, 1, 2]) expect(prompts[0]).toContain(`group ${i} observation ${BULLETS_PER_GROUP - 1}`);
    expect(prompts[0]).not.toContain('group 3 observation');

    // The cut is right after g2's closing tag (line 22), not inside g3.
    expect(cut).toBe(23);
    const lines = observations.split('\n');
    expect(lines[cut! - 1]).toBe('</observation-group>');

    // The activated observations have balanced tags, and g3-g5 kept their ids, ranges and bullets.
    const { opens, closes } = countTags(activeObservations);
    expect(opens).toBe(closes);
    const kept = parseObservationGroups(activeObservations).filter(g => g.kind !== 'reflection');
    expect(kept.map(g => [g.id, g.range])).toEqual([
      ['g3', 'm3a:m3b'],
      ['g4', 'm4a:m4b'],
      ['g5', 'm5a:m5b'],
    ]);
    for (const g of kept) expect(g.content.split('\n')).toHaveLength(BULLETS_PER_GROUP);
    expect(activeObservations).toContain('Reflected summary');
    expect(activeObservations).toContain('* later observation');
  });

  it('reflects the whole first group when it alone is larger than the reflection budget', async () => {
    // One 31-line group, a blank line and a 7-line group: 39 lines, so the raw cut is
    // floor(500 / (800 / 39)) = 24, inside the first group. No group closes before it
    // so the cut moves forward to the end of the first group instead of
    // reflecting nothing.
    const big = [
      '<observation-group id="big" range="b0:b1">',
      ...Array.from({ length: 29 }, (_, b) => `* big observation ${b}`),
      '</observation-group>',
    ].join('\n');
    const observations = [big, group(9)].join('\n\n');
    const { prompts, cut, activeObservations } = await bufferAndActivate(observations, {
      retrieval: true,
    });

    expect(cut).toBe(31);
    expect(prompts[0]).toContain('big observation 28');
    expect(prompts[0]).not.toContain('group 9 observation');
    const { opens, closes } = countTags(activeObservations);
    expect(opens).toBe(closes);
    const kept = parseObservationGroups(activeObservations).filter(g => g.kind !== 'reflection');
    expect(kept.map(g => g.id)).toEqual(['g9']);
  });

  it('leaves the line cut unchanged when observations have no group tags', async () => {
    // Retrieval off: plain bullets, so any line is a valid cut. 47 lines gives the same raw cut of
    // 29 lines as the grouped case.
    const observations = Array.from({ length: 47 }, (_, i) => `* plain observation ${i}`).join('\n');
    const { prompts, cut, activeObservations } = await bufferAndActivate(observations, {
      retrieval: false,
    });

    expect(cut).toBe(29);
    expect(prompts[0]).toContain('plain observation 28');
    expect(prompts[0]).not.toContain('plain observation 29');
    expect(activeObservations).toContain('* plain observation 29');
    expect(activeObservations).not.toContain('* plain observation 28\n');
  });
});
