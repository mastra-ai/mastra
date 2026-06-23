import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: text-streaming fidelity.
 *
 * The OpenAI SSE → AI SDK → Mastra output pipeline must preserve per-delta
 * ordering and content. When any layer of the stream reassembly breaks
 * (e.g. a dropped delta, reordered chunks, or a mismatched final text vs
 * concatenated deltas) this scenario trips.
 *
 * Asserts:
 *  - every `text-delta` chunk carries non-empty `payload`,
 *  - deltas arrive in order (no reorder between SSE frames),
 *  - their concatenation matches `output.text` exactly.
 *  - text-start/text-end chunks bracket text-delta chunks
 *  - step-start/step-finish bracket each model turn
 *  - start/finish bracket the entire run
 */
describeForAllEngines(
  'AIMock loop scenario: text-streaming fidelity',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('reassembles multi-delta text in order and matches output.text', async () => {
      const scriptedText =
        'The quick brown fox jumps over the lazy dog. ' +
        'Pack my box with five dozen liquor jugs. ' +
        'How vexingly quick daft zebras jump!';

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Write a long pangram paragraph.',
        stopWhen: stepCountIs(2),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: scriptedText });
        },
      });

      if (!chunks) {
        throw new Error('collectChunks should have populated chunks');
      }

      const textDeltas = chunks.filter((c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta');
      expect(textDeltas.length).toBeGreaterThan(0);

      // Every delta carries non-empty text.
      for (const delta of textDeltas) {
        expect(delta.payload).toBeTruthy();
        expect(typeof delta.payload.text).toBe('string');
        expect(delta.payload.text.length).toBeGreaterThan(0);
      }

      // Concatenation in arrival order equals the streamed text.
      const reassembled = textDeltas.map(d => d.payload.text).join('');
      const finalText = await (output as unknown as { text: Promise<string> }).text;
      expect(reassembled).toBe(finalText);

      // The reassembled text matches the scripted fixture content exactly.
      expect(finalText).toBe(scriptedText);
    });

    it('emits text-start/text-end bracketing and step/finish lifecycle chunks in order', async () => {
      const scriptedText = 'Hello world, this is a streaming fidelity test.';

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Test chunk ordering.',
        stopWhen: stepCountIs(2),
        collectChunks: true,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: scriptedText });
        },
      });

      if (!chunks) {
        throw new Error('collectChunks should have populated chunks');
      }

      // Extract chunk types in order
      const types = chunks.map(c => c.type);

      // Must start with 'start' chunk
      expect(types[0]).toBe('start');

      // Must end with 'finish' chunk
      expect(types[types.length - 1]).toBe('finish');

      // step-start must appear before text-delta
      const firstStepStart = types.indexOf('step-start');
      const firstTextDelta = types.indexOf('text-delta');
      expect(firstStepStart).toBeGreaterThanOrEqual(0);
      expect(firstTextDelta).toBeGreaterThan(firstStepStart);

      // text-start must appear before or at the same position as the first text-delta
      const textStartIdx = types.indexOf('text-start');
      expect(textStartIdx).toBeGreaterThanOrEqual(0);
      expect(textStartIdx).toBeLessThanOrEqual(firstTextDelta);

      // text-end must appear after the last text-delta
      const lastTextDelta = types.lastIndexOf('text-delta');
      const textEndIdx = types.indexOf('text-end');
      expect(textEndIdx).toBeGreaterThan(lastTextDelta);

      // step-finish must appear after text-end
      const stepFinishIdx = types.indexOf('step-finish');
      expect(stepFinishIdx).toBeGreaterThan(textEndIdx);

      // Verify the output text still matches
      const finalText = await (output as unknown as { text: Promise<string> }).text;
      expect(finalText).toBe(scriptedText);
    });
  },
  { skip: ['durable'] },
);
