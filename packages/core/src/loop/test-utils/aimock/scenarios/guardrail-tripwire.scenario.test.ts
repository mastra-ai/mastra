import { it, expect } from 'vitest';
import type { Processor } from '../../../../processors';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Error-state class: guardrail tripwire (processor abort).
 *
 * When an input processor calls `abort()`, the loop must short-circuit: emit a
 * `tripwire` chunk, finish with `finishReason: 'tripwire'`, and never reach the
 * model provider. This pins the guardrail contract that blocking processors
 * (moderation, prompt-injection, PII) rely on.
 */
describeForAllEngines('AIMock loop scenario: guardrail tripwire', engine => {
  const getMock = useLoopScenarioAimock();

  it('aborts before the model request when an input processor trips', async () => {
    const blockingProcessor: Processor = {
      id: 'blocking-guardrail',
      processInput: ({ messages, abort }) => {
        const text = JSON.stringify(messages);
        if (/forbidden/i.test(text)) {
          abort('blocked by guardrail');
        }
        return messages;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'This message contains a forbidden phrase.',
      inputProcessors: [blockingProcessor],
      fixtures: llm => {
        // If the guardrail works, this fixture is never used.
        llm.onMessage(/.*/, { content: 'The model should never run.' });
      },
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
      chunks.push(chunk);
    }

    // The canonical guardrail signal: a tripwire chunk carrying the abort reason.
    const tripwire = chunks.find(chunk => chunk.type === 'tripwire');
    expect(tripwire, 'expected a tripwire chunk').toBeDefined();
    expect(JSON.stringify((tripwire as { payload?: unknown })?.payload)).toMatch(/blocked by guardrail/i);

    // The run did not finish with a normal completion reason.
    expect(await output.finishReason).not.toBe('stop');

    // Crucially: the model provider was never reached.
    expect(requests).toHaveLength(0);

    // No model text leaked through.
    expect(await output.text).not.toContain('The model should never run.');
  });

  it('lets a non-matching message through to the model', async () => {
    const blockingProcessor: Processor = {
      id: 'blocking-guardrail',
      processInput: ({ messages, abort }) => {
        if (/forbidden/i.test(JSON.stringify(messages))) {
          abort('blocked by guardrail');
        }
        return messages;
      },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'This is a perfectly safe message.',
      inputProcessors: [blockingProcessor],
      fixtures: llm => {
        llm.onMessage(/.*/, { content: 'Safe response from the model.' });
      },
    });

    // The guardrail did not trip: the request reached the model and it replied.
    expect(requests).toHaveLength(1);
    expect(await output.text).toContain('Safe response from the model.');
    expect(await output.finishReason).not.toBe('tripwire');
  });
});
