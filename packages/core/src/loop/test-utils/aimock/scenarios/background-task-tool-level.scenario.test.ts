import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Tests tool-level background task opt-in.
 *
 * When a tool declares `background: { enabled: true }` and the agent opts it in
 * via `backgroundTasks: { tools: { toolName: true } }`, the tool runs asynchronously
 * and the agent stream emits background-task lifecycle chunks:
 *   - `background-task-started` when the task is dispatched
 *   - `background-task-completed` when it finishes with a result
 *
 * This pins the regression class where tool-level opt-in breaks and tools run
 * synchronously, blocking the agent loop.
 */
describeForAllEngines(
  'background-task-tool-level scenario',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('emits background-task-started/completed when tool opts in at tool level', async () => {
      // Track whether the tool executed
      let toolExecuted = false;

      const backgroundTool = createTool({
        id: 'background-work',
        description: 'Performs long-running work in the background',
        inputSchema: z.object({ duration: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        background: { enabled: true, timeoutMs: 5000 },
        execute: async ({ duration }) => {
          toolExecuted = true;
          // Simulate some async work
          await new Promise(resolve => setTimeout(resolve, 10));
          return { result: `Completed ${duration}ms work` };
        },
      });

      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Run the background work with duration 100',
        tools: { 'background-work': backgroundTool },
        agentBackgroundTasks: { tools: { 'background-work': true } },
        stopWhen: stepCountIs(3),
        backgroundTasks: { enabled: true },
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_bg', name: 'background-work', arguments: { duration: 100 } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Background task dispatched.' });
        },
      });

      // The tool executed (background tasks still execute, just asynchronously)
      expect(toolExecuted).toBe(true);

      // Verify background-task-started chunk was emitted
      const startedChunk = chunks?.find(c => c.type === 'background-task-started');
      expect(startedChunk).toBeDefined();
      expect(startedChunk?.payload).toMatchObject({
        toolName: 'background-work',
      });

      // The tool-result chunk should be emitted
      const toolResultChunk = chunks?.find(c => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      expect(toolResultChunk?.payload?.toolName).toBe('background-work');
    });
  },
  // TODO(durable-parity): unskip after Phase 4 wires `runOutputProcessorsForToolChunks`
  // into durable `llm-mapping` — the durable path currently doesn't emit a
  // `tool-result` chunk for background-task tool results.
  { skip: ['durable'] },
);
