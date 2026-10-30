import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: isTaskComplete with multiple scorers and strategies.
 *
 * When multiple scorers are configured with different strategies (all, any),
 * the loop should evaluate them correctly and emit the appropriate chunks.
 * This pins the multi-scorer evaluation path, ensuring strategy semantics
 * are preserved across refactors.
 */
describeForAllEngines('AIMock loop scenario: isTaskComplete with multiple scorers', engine => {
  const getMock = useLoopScenarioAimock();

  it('strategy: all - requires all scorers to pass', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    const scorer1Calls: number[] = [];
    const scorer2Calls: number[] = [];

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Complete the task.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      isTaskComplete: {
        strategy: 'all',
        scorers: [
          {
            id: 'scorer-1',
            name: 'Scorer 1',
            run: async (context: { iteration: number }) => {
              scorer1Calls.push(context.iteration);
              return { score: 1, reason: 'Passed' };
            },
          },
          {
            id: 'scorer-2',
            name: 'Scorer 2',
            run: async (context: { iteration: number }) => {
              scorer2Calls.push(context.iteration);
              return { score: 1, reason: 'Passed' };
            },
          },
        ],
      },
      fixtures: llm => {
        // Model calls tool once, then finishes
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick_1', name: 'tick', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Task complete.' });
      },
    });

    // Both scorers should have been called
    expect(scorer1Calls.length).toBeGreaterThan(0);
    expect(scorer2Calls.length).toBeGreaterThan(0);

    // Should have is-task-complete chunks
    const taskCompleteChunks = chunks?.filter(c => c?.type === 'is-task-complete') || [];
    expect(taskCompleteChunks.length).toBeGreaterThan(0);

    // Final chunk should show passed=true (both scorers passed)
    const finalChunk = taskCompleteChunks[taskCompleteChunks.length - 1] as any;
    expect(finalChunk.payload.passed).toBe(true);

    // Should include results from both scorers
    expect(finalChunk.payload.results).toHaveLength(2);
  });

  it('strategy: any - requires at least one scorer to pass', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Complete the task.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      isTaskComplete: {
        strategy: 'any',
        scorers: [
          {
            id: 'scorer-strict',
            name: 'Strict Scorer',
            run: async () => ({ score: 0, reason: 'Never passes' }),
          },
          {
            id: 'scorer-lenient',
            name: 'Lenient Scorer',
            run: async () => ({ score: 1, reason: 'Passed' }),
          },
        ],
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick_1', name: 'tick', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Task complete.' });
      },
    });

    // Should have is-task-complete chunks
    const taskCompleteChunks = chunks?.filter(c => c?.type === 'is-task-complete') || [];
    expect(taskCompleteChunks.length).toBeGreaterThan(0);

    // Final chunk should show passed=true (lenient scorer passed)
    const finalChunk = taskCompleteChunks[taskCompleteChunks.length - 1] as any;
    expect(finalChunk.payload.passed).toBe(true);

    // Should include results from both scorers
    expect(finalChunk.payload.results).toHaveLength(2);
  });

  it('strategy: all - fails when any scorer fails', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Complete the task.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(2),
      collectChunks: true,
      isTaskComplete: {
        strategy: 'all',
        scorers: [
          {
            id: 'scorer-pass',
            name: 'Pass Scorer',
            run: async () => ({ score: 1, reason: 'Passed' }),
          },
          {
            id: 'scorer-fail',
            name: 'Fail Scorer',
            run: async () => ({ score: 0, reason: 'Failed' }),
          },
        ],
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Task attempt.' });
      },
    });

    // Should have is-task-complete chunks
    const taskCompleteChunks = chunks?.filter(c => c?.type === 'is-task-complete') || [];
    expect(taskCompleteChunks.length).toBeGreaterThan(0);

    // Final chunk should show passed=false (one scorer failed)
    const finalChunk = taskCompleteChunks[taskCompleteChunks.length - 1] as any;
    expect(finalChunk.payload.passed).toBe(false);

    // Should include results from both scorers
    expect(finalChunk.payload.results).toHaveLength(2);
  });
});
