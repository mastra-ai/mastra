import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: supervisor-style `isTaskComplete` reporting and final text.
 *
 * Moved from `agent/__tests__/supervisor-integration.test.ts`. The gating loop
 * itself (fail → re-run → pass) lives in `is-task-complete-gating`, and the
 * all/any strategies in `is-task-complete-multiple-scorers`. This file pins what
 * those don't:
 *  - the resolved text is the model's answer, never the injected
 *    "Completion Check Results" report — whether the check passes or keeps
 *    failing until maxSteps — and the report is not persisted to the thread,
 *  - the `is-task-complete` chunk carries each scorer's id and reason,
 *    `suppressFeedback`, and `maxIterationReached`,
 *  - `onIterationComplete` fires once per scorer-driven iteration with
 *    `isFinal` only on the last.
 */
describeForAllEngines('AIMock loop scenario: supervisor isTaskComplete', engine => {
  // Inngest's agentic loop does not call onIterationComplete yet.
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
  const getMock = useLoopScenarioAimock();

  const scorer = (id: string, results: Array<{ score: number; reason: string }>) => {
    let call = 0;
    return {
      id,
      name: id,
      run: async () => results[Math.min(call++, results.length - 1)]!,
    } as any;
  };

  const taskCompleteChunks = (chunks: any[] | undefined) =>
    (chunks ?? []).filter(c => c.type === 'is-task-complete').map(c => c.payload);

  it('resolves the model answer as final text and does not persist the report when the check passes', async () => {
    const answer = 'Both accounts are healthy. Nothing needs attention.';
    const memory = new MockMemory();
    const threadId = `itc-pass-${engine}`;
    const resourceId = 'itc-res';
    await memory.saveThread({
      thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date() },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Check the accounts.',
      maxSteps: 4,
      memory,
      threadId,
      resourceId,
      errorProcessors: [],
      isTaskComplete: { scorers: [scorer('always-complete', [{ score: 1, reason: 'Task is complete' }])] },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: answer });
      },
    });

    expect(requests).toHaveLength(1);
    expect(await output.text).toBe(answer);

    const { messages } = await memory.recall({ threadId, resourceId });
    const persisted = JSON.stringify(messages);
    expect(persisted).toContain(answer);
    expect(persisted).not.toContain('Completion Check Results');
  });

  it('resolves the last model answer as final text when the check keeps failing until maxSteps', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Do the task.',
      maxSteps: 2,
      errorProcessors: [],
      isTaskComplete: { scorers: [scorer('never-complete', [{ score: 0, reason: 'Not complete' }])] },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Attempt one.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Attempt two.' });
      },
    });

    expect(requests).toHaveLength(2);
    expect(JSON.stringify((requests[1]!.body as any).messages)).toContain('Completion Check Results');
    const text = await output.text;
    expect(text).not.toContain('Completion Check Results');
    expect(text.endsWith('Attempt two.')).toBe(true);
  });

  it('reports scorer id, reason and pass state in the is-task-complete chunk', async () => {
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Do the task.',
      maxSteps: 3,
      collectChunks: true,
      errorProcessors: [],
      isTaskComplete: {
        scorers: [
          scorer('detailed-scorer', [{ score: 1, reason: 'Task clearly completed with all requirements met' }]),
        ],
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Done.' });
      },
    });

    const [payload] = taskCompleteChunks(chunks);
    expect(payload.passed).toBe(true);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].scorerId).toBe('detailed-scorer');
    expect(payload.results[0].reason).toBe('Task clearly completed with all requirements met');
  });

  it('reports suppressFeedback on the is-task-complete chunk (false by default)', async () => {
    const run = (suppressFeedback?: boolean) =>
      runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Do the task.',
        maxSteps: 3,
        collectChunks: true,
        errorProcessors: [],
        isTaskComplete: {
          scorers: [scorer('scorer', [{ score: 1, reason: 'Done' }])],
          ...(suppressFeedback === undefined ? {} : { suppressFeedback }),
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });

    const suppressed = taskCompleteChunks((await run(true)).chunks);
    const getDefault = taskCompleteChunks((await run()).chunks);
    expect(suppressed[0].suppressFeedback).toBe(true);
    expect(getDefault[0].suppressFeedback).toBe(false);
  });

  it('reports maxIterationReached only on the iteration that hits maxSteps', async () => {
    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Do the task.',
      maxSteps: 2,
      collectChunks: true,
      errorProcessors: [],
      isTaskComplete: {
        scorers: [
          scorer('max-iter-scorer', [
            { score: 0, reason: 'Not yet done' },
            { score: 1, reason: 'Done on second attempt' },
          ]),
        ],
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Response 1' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Response 2' });
      },
    });

    expect(requests).toHaveLength(2);
    const payloads = taskCompleteChunks(chunks);
    expect(payloads.map(p => [p.passed, p.maxIterationReached])).toEqual([
      [false, false],
      [true, true],
    ]);
  });

  itFailsOnInngest('calls onIterationComplete once per scorer-driven iteration, isFinal only on the last', async () => {
    const iterations: Array<{ iteration: number; isFinal: boolean; text: string }> = [];

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Complete a complex task.',
      maxSteps: 5,
      errorProcessors: [],
      isTaskComplete: {
        scorers: [
          scorer('multi-iter-scorer', [
            { score: 0, reason: 'Attempt 1 not complete' },
            { score: 0, reason: 'Attempt 2 not complete' },
            { score: 1, reason: 'Finally complete' },
          ]),
        ],
      },
      onIterationComplete: (ctx: any) => {
        iterations.push({ iteration: ctx.iteration, isFinal: ctx.isFinal, text: ctx.text });
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Response 1' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Response 2' });
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Response 3' });
      },
    });

    expect(requests).toHaveLength(3);
    expect(iterations.map(i => [i.iteration, i.isFinal])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    expect((await output.text).endsWith('Response 3')).toBe(true);
  });
});
