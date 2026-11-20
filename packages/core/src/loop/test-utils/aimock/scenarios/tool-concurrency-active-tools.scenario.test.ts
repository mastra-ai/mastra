/**
 * AIMock Scenario: tool concurrency follows the tools the step can actually call
 *
 * Approval and suspend-schema tools force sequential execution. That decision
 * must be based on the tools active for the step (activeTools, prepareStep
 * replacements), not every tool registered on the agent.
 *
 * Durable engines always run tool calls sequentially via workflow `foreach`, so
 * the peak-concurrency assertion only applies to the plain loop.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { delay } from '../../../../utils';
import {
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: tool concurrency with active tools', engine => {
  const getMock = useLoopScenarioAimock();

  function trackedTools() {
    const tracker = { running: 0, peak: 0, completed: [] as string[] };
    const make = (id: string) =>
      createTool({
        id,
        description: `Tracked ${id}`,
        inputSchema: z.object({ data: z.string() }),
        execute: async () => {
          tracker.running++;
          tracker.peak = Math.max(tracker.peak, tracker.running);
          await delay(50);
          tracker.running--;
          tracker.completed.push(id);
          return { result: `${id} done` };
        },
      });
    return { tracker, tools: { tool_1: make('tool_1'), tool_2: make('tool_2') } };
  }

  const approvalTool = createTool({
    id: 'approval_tool',
    description: 'Approval tool',
    inputSchema: z.object({ data: z.string() }),
    requireApproval: true,
    execute: async () => ({ result: 'approval done' }),
  });

  const suspendingTool = createTool({
    id: 'suspending_tool',
    description: 'Suspending tool',
    inputSchema: z.object({ data: z.string() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async () => ({ result: 'suspending done' }),
  });

  const fixtures = (llm: ReturnType<typeof getMock>) => {
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          { id: 'call-1', name: 'tool_1', arguments: { data: 'a' } },
          { id: 'call-2', name: 'tool_2', arguments: { data: 'b' } },
        ],
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
  };

  async function expectConcurrent(tracker: { peak: number; completed: string[] }, output: { text: Promise<string> }) {
    expect(await output.text).toBe('done');
    expect(tracker.completed).toEqual(expect.arrayContaining(['tool_1', 'tool_2']));
    if (!isDurableEngineVariant(engine)) expect(tracker.peak).toBe(2);
  }

  it.each([
    ['an approval tool', { approval_tool: approvalTool }],
    ['a suspending tool', { suspending_tool: suspendingTool }],
  ])('runs active tools concurrently when %s is registered but inactive', async (_label, extra) => {
    const { tracker, tools } = trackedTools();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use both tools',
      tools: { ...tools, ...extra },
      activeTools: ['tool_1', 'tool_2'],
      stopWhen: stepCountIs(3),
      fixtures,
    });
    await expectConcurrent(tracker, output);
  });

  it('uses prepareStep-replaced tools when resolving concurrency', async () => {
    const { tracker, tools } = trackedTools();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use both tools',
      tools: { approval_tool: approvalTool },
      prepareStep: () => ({ tools, activeTools: undefined }) as any,
      stopWhen: stepCountIs(3),
      fixtures,
    });
    await expectConcurrent(tracker, output);
  });
});
