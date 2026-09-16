/**
 * AIMock Scenario: stopWhen sees populated content/toolResults for a later
 * multi-tool step.
 *
 * Regression for the reported bug where, in a multi-turn agent loop, the LAST
 * step that makes multiple tool calls arrives in the `stopWhen` predicate with
 * an empty `content`/`toolResults` while `toolCalls` stays populated.
 *
 * The multi-tool call must NOT be on the first step: only once
 * `previousContentLength` has advanced past an earlier step does the
 * snapshot-slice derivation misalign with the step boundary and drop the
 * multi-tool step's content.
 */

import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: stopWhen multi-tool step', engine => {
  const getMock = useLoopScenarioAimock();

  it('stopWhen sees populated content/toolResults when a later step makes multiple tool calls', async () => {
    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
    });
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo a value.',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });

    const stopWhenCalls: Array<Array<{ toolResultCount: number; contentToolResultCount: number; toolCallCount: number }>> =
      [];

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up alpha, then look up beta and echo gamma.',
      tools: { lookup: lookupTool, echo: echoTool },
      stopWhen: ({ steps }: { steps: any[] }) => {
        stopWhenCalls.push(
          (steps || []).map(step => ({
            toolResultCount: (step.toolResults || []).length,
            contentToolResultCount: (step.content || []).filter((part: any) => part.type === 'tool-result').length,
            toolCallCount: (step.toolCalls || []).length,
          })),
        );
        return false;
      },
      fixtures: llm => {
        // Turn 0: a single tool call — advances previousContentLength.
        llm.on(
          { endpoint: 'chat', turnIndex: 0 },
          { toolCalls: [{ id: 'call_lookup_1', name: 'lookup', arguments: { key: 'alpha' } }] },
        );
        // Turn 1: TWO tool calls in a single step — the multi-tool step under test.
        llm.on(
          { endpoint: 'chat', turnIndex: 1 },
          {
            toolCalls: [
              { id: 'call_lookup_2', name: 'lookup', arguments: { key: 'beta' } },
              { id: 'call_echo', name: 'echo', arguments: { text: 'gamma' } },
            ],
          },
        );
        // Turn 2: final text.
        llm.on({ endpoint: 'chat', turnIndex: 2 }, { content: 'Done.' });
      },
    });

    if (engine === 'durable') {
      // Durable keeps completed steps on the workflow state and does not forward
      // the same in-memory step objects; covered by the normal/fs engines.
      return;
    }

    // stopWhen must have been called at least once with a captured multi-tool step.
    const allSteps = stopWhenCalls.flat();
    const multiToolStep = allSteps.find(step => step.toolCallCount === 2);
    expect(multiToolStep).toBeDefined();
    // The multi-tool step must expose BOTH tool results (content + toolResults),
    // not an empty content/toolResults while toolCalls stays populated.
    expect(multiToolStep!.toolResultCount).toBe(2);
    expect(multiToolStep!.contentToolResultCount).toBe(2);
  });
});
