import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: activeTools filtering is enforced at tool EXECUTION time,
 * not just at the model prompt level. A model can hallucinate (or replay from
 * conversation history) a call to a tool that is not in `activeTools`; that
 * call must be rejected without running the tool's execute().
 *
 * Ported from packages/core/src/agent/__tests__/active-tools-enforcement.test.ts
 * (default-engine generate() path) to the cross-engine scenario matrix.
 * `prepare-step.scenario.test.ts` covers prompt-level filtering; this file
 * covers the execution-time gate.
 */
describeForAllEngines('AIMock loop scenario: activeTools enforcement at execution time', engine => {
  const getMock = useLoopScenarioAimock();

  const makeTool = (id: string, execute: (...args: any[]) => any) =>
    createTool({
      id,
      description: `Tool ${id}`,
      inputSchema: z.object({ value: z.string() }),
      execute,
    });

  it('rejects tool calls for tools not in activeTools', async () => {
    const allowedExecute = vi.fn().mockResolvedValue('allowed result');
    const hiddenExecute = vi.fn().mockResolvedValue('hidden result');

    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: {
        allowedTool: makeTool('allowedTool', allowedExecute),
        hiddenTool: makeTool('hiddenTool', hiddenExecute),
      },
      stopWhen: stepCountIs(3),
      prepareStep: () => ({
        activeTools: ['allowedTool'],
      }),
      fixtures: llm => {
        // Turn 1: the model calls a tool that is NOT in activeTools.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call-1', name: 'hiddenTool', arguments: { value: 'test' } }],
          },
        );
        // Turn 2: model gives up and returns text.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    // The hidden tool should NOT have been executed.
    expect(hiddenExecute).not.toHaveBeenCalled();

    // Model was called twice: first with hidden tool call (rejected), then text response.
    expect(requests).toHaveLength(2);
    expect(await output.text).toBe('Done.');
  });

  it('allows tool calls for tools in activeTools', async () => {
    const allowedExecute = vi.fn().mockResolvedValue('allowed result');

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: {
        allowedTool: makeTool('allowedTool', allowedExecute),
        hiddenTool: makeTool('hiddenTool', vi.fn().mockResolvedValue('hidden result')),
      },
      stopWhen: stepCountIs(3),
      prepareStep: () => ({
        activeTools: ['allowedTool'],
      }),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call-1', name: 'allowedTool', arguments: { value: 'test' } }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    // The allowed tool should have been executed.
    expect(allowedExecute).toHaveBeenCalledOnce();
  });

  it('does not restrict tools when activeTools is not set', async () => {
    const tool1Execute = vi.fn().mockResolvedValue('result1');
    const tool2Execute = vi.fn().mockResolvedValue('result2');

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      tools: {
        tool1: makeTool('tool1', tool1Execute),
        tool2: makeTool('tool2', tool2Execute),
      },
      stopWhen: stepCountIs(3),
      // No prepareStep = no activeTools restriction.
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call-1', name: 'tool1', arguments: { value: 'test' } },
              { id: 'call-2', name: 'tool2', arguments: { value: 'test' } },
            ],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(tool1Execute).toHaveBeenCalledOnce();
    expect(tool2Execute).toHaveBeenCalledOnce();
  });
});
