import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { NetworkChunkType } from '../../../../stream/types';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  drain,
  fixedScorer,
  isFinalResultRequest,
  isRoutingRequest,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * Network completion with custom scorers: validation events, retries until a
 * scorer passes, maxSteps, strategies, onIterationComplete and the feedback
 * message saved for the router when a check fails.
 */
describeForAllEngines(
  'AIMock network scenario: completion scorers',
  engine => {
    const getMock = useLoopScenarioAimock();

    function setup(id: string) {
      const llm = getMock();
      const memory = new MockMemory();
      const network = new Agent({ id, name: id, instructions: 'Route.', model: scenarioModel(llm), memory });
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('none', 'none', ''));
      llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: JSON.stringify({ finalResult: '' }) });
      return { llm, memory, network, memoryOpts: { thread: `${id}-thread`, resource: `${id}-resource` } };
    }

    type ValidationEndPayload = { passed: boolean; results: Array<{ reason?: string; passed: boolean }> };
    const validationEnds = (chunks: NetworkChunkType[]) =>
      chunks.filter(c => c.type === 'network-validation-end').map(c => c.payload as unknown as ValidationEndPayload);

    async function savedTexts(memory: MockMemory, memoryOpts: { thread: string; resource: string }) {
      const { messages } = await memory.recall({ threadId: memoryOpts.thread, resourceId: memoryOpts.resource });
      return messages;
    }

    it('runs custom scorers instead of the default check and reports a pass', async () => {
      const { network, memoryOpts, llm } = setup('scorer-pass');
      const scorer = fixedScorer('pass', 1, 'Test passed');

      const chunks = await drain(
        await forEngine(network, engine).network('Do something simple', {
          completion: { scorers: [scorer] },
          memory: memoryOpts,
        }),
      );

      expect(scorer.runs).toHaveLength(1);
      expect(chunks.some(c => c.type === 'network-validation-start')).toBe(true);
      expect(validationEnds(chunks)).toEqual([expect.objectContaining({ passed: true })]);
      // The default LLM completion check never runs when scorers are configured.
      expect(
        llm.getRequests().some(r => JSON.stringify(r.body).includes('You need to evaluate if the task is complete')),
      ).toBe(false);
    });

    it('reports a failing scorer and its reason', async () => {
      const { network, memoryOpts } = setup('scorer-fail');

      const chunks = await drain(
        await forEngine(network, engine).network('Do something', {
          completion: { scorers: [fixedScorer('fail', 0, 'Test failed intentionally')] },
          maxSteps: 1,
          memory: memoryOpts,
        }),
      );

      const [first] = validationEnds(chunks);
      expect(first).toMatchObject({ passed: false, results: [{ reason: 'Test failed intentionally' }] });
    });

    it('retries after a failed check and finishes when the next check passes', async () => {
      const { network, memoryOpts } = setup('scorer-retry');
      let calls = 0;
      const scorer = fixedScorer('retry', () => (++calls === 1 ? 0 : 1));

      const chunks = await drain(
        await forEngine(network, engine).network('Needs a retry', {
          completion: { scorers: [scorer] },
          maxSteps: 5,
          memory: memoryOpts,
        }),
      );

      expect(validationEnds(chunks).map(v => v.passed)).toEqual([false, true]);
    });

    it('stops at maxSteps when checks keep failing', async () => {
      const { network, memoryOpts } = setup('scorer-max-steps');
      const scorer = fixedScorer('never', 0, 'Always fails');

      const chunks = await drain(
        await forEngine(network, engine).network('Impossible', {
          completion: { scorers: [scorer] },
          maxSteps: 3,
          memory: memoryOpts,
        }),
      );

      // Iterations 0..3 each run the check once; the run ends instead of looping forever.
      expect(validationEnds(chunks).map(v => v.passed)).toEqual([false, false, false, false]);
      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
    });

    it('requires every scorer to pass with the all strategy', async () => {
      const { network, memoryOpts } = setup('strategy-all');

      const chunks = await drain(
        await forEngine(network, engine).network('Do something', {
          completion: { scorers: [fixedScorer('ok', 1, 'Passed'), fixedScorer('bad', 0, 'Failed')], strategy: 'all' },
          maxSteps: 1,
          memory: memoryOpts,
        }),
      );

      const [first] = validationEnds(chunks);
      expect(first!.passed).toBe(false);
      expect(first!.results.map(r => r.passed)).toEqual([true, false]);
    });

    it('passes when any scorer passes with the any strategy', async () => {
      const { network, memoryOpts } = setup('strategy-any');

      const chunks = await drain(
        await forEngine(network, engine).network('Do something', {
          completion: { scorers: [fixedScorer('ok', 1, 'Passed'), fixedScorer('bad', 0, 'Failed')], strategy: 'any' },
          memory: memoryOpts,
        }),
      );

      expect(validationEnds(chunks)[0]!.passed).toBe(true);
    });

    it('calls onIterationComplete once per iteration with that iteration result', async () => {
      const { network, memoryOpts } = setup('iteration-complete');
      let calls = 0;
      const scorer = fixedScorer('third-time', () => (++calls < 3 ? 0 : 1));
      const iterations: Array<Record<string, unknown>> = [];

      await drain(
        await forEngine(network, engine).network('Do something complex', {
          completion: { scorers: [scorer] },
          maxSteps: 5,
          onIterationComplete: context => {
            iterations.push({ ...context });
          },
          memory: memoryOpts,
        }),
      );

      expect(iterations.map(i => [i.iteration, i.isComplete])).toEqual([
        [0, false],
        [1, false],
        [2, true],
      ]);
      expect(iterations[2]).toMatchObject({ primitiveId: 'none', primitiveType: 'none', result: expect.any(String) });
    });

    it('saves the failed check as feedback with the scorer name and reason', async () => {
      const { network, memory, memoryOpts } = setup('feedback');

      await drain(
        await forEngine(network, engine).network('Do something', {
          completion: { scorers: [fixedScorer('Feedback Scorer', 0, 'Custom failure reason')] },
          maxSteps: 1,
          memory: memoryOpts,
        }),
      );

      const feedback = (await savedTexts(memory, memoryOpts)).filter(m => m.content.metadata?.completionResult);
      expect(feedback.length).toBeGreaterThan(0);
      const part = feedback[0]!.content.parts[0];
      const text = part?.type === 'text' ? part.text : '';
      expect(text).toContain('Completion Check Results');
      expect(text).toContain('NOT COMPLETE');
      expect(text).toContain('Feedback Scorer');
      expect(text).toContain('Custom failure reason');
      expect(
        feedback.some(m => (m.content.metadata?.completionResult as { suppressFeedback?: boolean }).suppressFeedback),
      ).toBe(false);
    });

    it('marks saved feedback with suppressFeedback when requested', async () => {
      const { network, memory, memoryOpts } = setup('suppress-feedback');

      await drain(
        await forEngine(network, engine).network('Do something', {
          completion: { scorers: [fixedScorer('fail', 0)], suppressFeedback: true },
          maxSteps: 1,
          memory: memoryOpts,
        }),
      );

      const feedback = (await savedTexts(memory, memoryOpts)).filter(m => m.content.metadata?.completionResult);
      expect(feedback.length).toBeGreaterThan(0);
      expect(
        feedback.every(m => (m.content.metadata?.completionResult as { suppressFeedback?: boolean }).suppressFeedback),
      ).toBe(true);
    });
  },
  NETWORK_ENGINE_SKIP,
);
