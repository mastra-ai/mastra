import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Tests agent-level background task opt-in and resolution order.
 *
 * Per the docs, the resolved background config is computed in this priority:
 *   1. Agent-level `backgroundTasks.tools` entry for the tool.
 *   2. Tool-level `backgroundTasks` config.
 *   3. LLM `_background.enabled` override (only when opted in at 1 or 2).
 *   4. Manager defaults.
 *
 * This scenario pins the regression class where agent-level opt-in fails to
 * elevate a tool to background dispatch when the tool itself has not opted in.
 */
describeForAllEngines('background-task-agent-level scenario', engine => {
  const getMock = useLoopScenarioAimock();

  it('opts in a non-background tool at agent level and dispatches it in the background', async () => {
    // Tool WITHOUT tool-level `background: { enabled: true }` — agent-level must
    // elevate it.
    const plainTool = createTool({
      id: 'plain-work',
      description: 'Performs work (no tool-level opt-in)',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ summary: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { summary: `Summary of ${topic}` };
      },
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Research quantum',
      tools: { 'plain-work': plainTool },
      agentBackgroundTasks: { tools: { 'plain-work': true } },
      stopWhen: stepCountIs(3),
      backgroundTasks: { enabled: true },
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_plain', name: 'plain-work', arguments: { topic: 'quantum' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Agent-level background dispatch worked.' });
      },
    });

    // Agent-level opt-in elevated the tool: background-task-started chunk emitted
    // even though the tool itself did not declare `background: { enabled: true }`.
    const startedChunk = chunks?.find(c => c.type === 'background-task-started');
    expect(startedChunk).toBeDefined();
    expect(startedChunk?.payload).toMatchObject({
      toolName: 'plain-work',
    });
  });
});
