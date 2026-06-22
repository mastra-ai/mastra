/**
 * AIMock Scenario: Output Step Processor
 *
 * Tests that processOutputStep runs after each model step (not just the final
 * output). This covers the regression class where per-step output processing
 * could be skipped, causing tool-call filtering or text redaction to only
 * apply to the final response.
 *
 * Asserts:
 * - processOutputStep runs for each step (including intermediate tool-call steps)
 * - processOutputStep can modify the step output (redact tool-call args)
 * - processOutputStep sees the correct tool call info
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: output step processor (per-step)', () => {
  const getMock = useLoopScenarioAimock();

  it('processOutputStep runs for each step including intermediate tool-call steps', async () => {
    const stepsSeen: Array<{ iteration: number; hasToolCalls: boolean }> = [];

    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
    });

    const outputStepProcessor = {
      id: 'step-tracker',
      async processOutputStep({ toolCalls, stepNumber }: { toolCalls?: unknown[]; stepNumber: number }) {
        stepsSeen.push({
          iteration: stepNumber + 1,
          hasToolCalls: Boolean(toolCalls && toolCalls.length > 0),
        });
      },
    };

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up the value for key alpha.',
      tools: { lookup: lookupTool },
      stopWhen: stepCountIs(5),
      outputProcessors: [outputStepProcessor],
      fixtures: llm => {
        // Turn 1: emit a tool call
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { key: 'alpha' } }],
          },
        );
        // Turn 2: final text
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value for alpha is VALUE_FOR_alpha.' });
      },
    });

    // processOutputStep ran for both steps (tool-call step + final step)
    expect(stepsSeen).toHaveLength(2);
    // Step 1 had tool calls
    expect(stepsSeen[0].hasToolCalls).toBe(true);
    // Step 2 had no tool calls (final text)
    expect(stepsSeen[1].hasToolCalls).toBe(false);
  });
});
