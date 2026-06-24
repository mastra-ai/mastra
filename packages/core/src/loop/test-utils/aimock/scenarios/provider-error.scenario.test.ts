import { it, expect } from 'vitest';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Error-state class: provider / API failure mid-loop.
 *
 * When the model provider returns an HTTP error, the loop must surface it as an
 * `error` chunk and finish with `finishReason: 'error'` rather than hanging or
 * throwing through `consumeStream`. This pins the failure contract that every
 * loop consumer relies on for graceful degradation.
 */
describeForAllEngines(
  'AIMock loop scenario: provider error',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('surfaces an error chunk and finishReason "error" when the provider returns a 500', async () => {
      const { output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Trigger a provider failure.',
        fixtures: llm => {
          // AIMock returns an OpenAI-style error body with a 500 status.
          llm.onMessage(/.*/, {
            error: { message: 'AIMOCK_PROVIDER_BOOM', type: 'server_error', code: 'internal_error' },
            status: 500,
          });
        },
      });

      // Collect chunks off the full stream so we can inspect the error chunk.
      const chunks: ChunkType[] = [];
      for await (const chunk of output.fullStream as AsyncIterable<ChunkType>) {
        chunks.push(chunk);
      }

      const errorChunk = chunks.find(chunk => chunk.type === 'error');
      expect(errorChunk, 'expected the loop to emit an error chunk').toBeDefined();
      expect(JSON.stringify((errorChunk as { payload?: unknown })?.payload)).toMatch(/boom|error|500/i);

      // The run finished in the error state, not a normal stop.
      expect(await output.finishReason).toBe('error');
    });
  },
  { skip: ['durable'] },
);
