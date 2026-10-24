import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: structured output streamed over many small deltas (#26575).
 *
 * Each partial parse re-reads the whole accumulated JSON, so parsing on every
 * delta made long structured outputs quadratic (8000 deltas took ~2 minutes).
 * Every parse that changes the value emits an `object` chunk, so the number of
 * `object` chunks a consumer sees is the observable measure of that work.
 */
describeForAllEngines('AIMock loop scenario: long structured-output stream', engine => {
  const getMock = useLoopScenarioAimock();

  it('throttles partial objects on long outputs and still ends on the complete object', async () => {
    const schema = z.object({ answer: z.string() });
    const answer = 'abcd'.repeat(25_000);

    const { output, chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Write the long answer.',
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: JSON.stringify({ answer }) }, { chunkSize: 32 });
      },
    });

    expect((requests[0]?.body as any)?.messages?.at(-1)).toEqual({ role: 'user', content: 'Write the long answer.' });

    const all = (chunks ?? []) as ChunkType[];
    const deltaCount = all.filter(c => c.type === 'text-delta').length;
    const objects = all.filter(c => c.type === 'object') as Array<{ object: unknown }>;
    expect(deltaCount).toBeGreaterThan(3000);
    // Re-parsing on every delta emits one partial object per delta (~3000 here).
    expect(objects.length, 'partial object emitted for (almost) every delta: parsing is not throttled').toBeLessThan(
      deltaCount / 5,
    );
    // Throttling must not leave consumers with a stale last partial.
    expect(objects.at(-1)?.object, 'last partial object is stale: skipped text was never parsed').toEqual({ answer });
    expect(await (output as unknown as { object: Promise<unknown> }).object).toEqual({ answer });
  });

  it('emits a partial object for every value change in short outputs', async () => {
    const schema = z.object({ answer: z.string() });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Short answer.',
      structuredOutput: { schema },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '{"answer":"abc"}' }, { chunkSize: 1 });
      },
    });

    const partials = ((chunks ?? []) as ChunkType[])
      .filter(c => c.type === 'object')
      .map(c => (c as { object: unknown }).object);
    expect(partials).toEqual([{}, { answer: '' }, { answer: 'a' }, { answer: 'ab' }, { answer: 'abc' }]);
  });
});
