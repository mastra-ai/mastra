import { it, expect } from 'vitest';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Concept: the per-call `onChunk` callback.
 *
 * Every chunk the caller can read from `fullStream` is also delivered to
 * `onChunk`, on every engine. Text deltas arrive in stream order, so joining
 * them reproduces the final text.
 */
describeForAllEngines('AIMock loop scenario: onChunk delivery', engine => {
  const getMock = useLoopScenarioAimock();

  it('delivers every text-delta to onChunk in order', async () => {
    const received: ChunkType[] = [];

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Say hello in parts.',
      onChunk: chunk => {
        received.push(chunk);
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hello, world!' }, { chunkSize: 3 });
      },
    });

    const deltas = received.filter(chunk => chunk.type === 'text-delta');
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.map(chunk => (chunk.payload as { text: string }).text).join('')).toBe('Hello, world!');
    expect(await output.text).toBe('Hello, world!');
  });
});
