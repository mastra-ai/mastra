/**
 * AIMock Scenario: processor step number
 *
 * Every per-step processor hook receives the zero-based index of the step it
 * runs in and the list of steps finished before it. A hook that always saw
 * step 0 could not tell the first model call from a later one (#24279).
 *
 * Asserts, across a tool-call step followed by a text step:
 * - processInputStep, processLLMRequest, processLLMResponse and
 *   processOutputStep each see stepNumber 0 then 1
 * - each sees no finished steps in step 0 and one in step 1
 */

import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../../../processors/index';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const HOOKS = ['input', 'request', 'response', 'output'] as const;
type Hook = (typeof HOOKS)[number];

describeForAllEngines('AIMock loop scenario: processor step number', engine => {
  const getMock = useLoopScenarioAimock();

  it('passes the current step index and finished steps to every processor hook', async () => {
    const seen: Record<Hook, Array<{ stepNumber: number; finishedSteps: number }>> = {
      input: [],
      request: [],
      response: [],
      output: [],
    };
    const record = (hook: Hook, args: { stepNumber: number; steps: unknown[] }) => {
      seen[hook].push({ stepNumber: args.stepNumber, finishedSteps: args.steps.length });
    };
    const captureSteps: Processor = {
      id: 'capture-steps',
      processInputStep: async args => {
        record('input', args);
        return args.messageList;
      },
      processLLMRequest: async args => {
        record('request', args);
      },
      processLLMResponse: async args => {
        record('response', args);
      },
      processOutputStep: async args => {
        record('output', args);
        return args.messageList;
      },
    };
    const echo = createTool({
      id: 'echo',
      description: 'Echoes.',
      inputSchema: z.object({}),
      execute: async () => 'done',
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'go',
      tools: { echo },
      maxSteps: 2,
      inputProcessors: [captureSteps],
      // processOutputStep only runs for output processors
      outputProcessors: [captureSteps],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'final' });
      },
    });

    expect(requests).toHaveLength(2);
    for (const hook of HOOKS) {
      expect(seen[hook], `${hook} hook`).toEqual([
        { stepNumber: 0, finishedSteps: 0 },
        { stepNumber: 1, finishedSteps: 1 },
      ]);
    }
  });
});
