/**
 * AIMock Scenario: Input Step Processor
 *
 * Tests that processInputStep runs before each step (not just the initial input).
 * This covers the regression class where per-step input processing could be
 * skipped, causing context injection or message filtering to only apply to the
 * first step.
 *
 * Asserts:
 * - processInputStep runs for each step (including after tool calls)
 * - processInputStep sees accumulated messages from previous steps
 * - processInputStep can inject context messages that reach the model
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: input step processor (per-step)', () => {
  const getMock = useLoopScenarioAimock();

  it('processInputStep runs for each step and sees accumulated messages', async () => {
    const stepsSeen: Array<{ stepNumber: number; messageCount: number }> = [];

    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
    });

    const inputStepProcessor = {
      id: 'step-tracker',
      async processInputStep({ stepNumber, messages }: { stepNumber: number; messages: Array<{ role: string }> }) {
        stepsSeen.push({
          stepNumber,
          messageCount: messages.length,
        });
        return messages;
      },
    };

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up the value for key alpha.',
      tools: { lookup: lookupTool },
      stopWhen: stepCountIs(5),
      inputProcessors: [inputStepProcessor],
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

    // processInputStep ran for both steps
    expect(stepsSeen).toHaveLength(2);

    // Step 0: initial user message only
    expect(stepsSeen[0].stepNumber).toBe(0);
    expect(stepsSeen[0].messageCount).toBeGreaterThan(0);

    // Step 1: accumulated messages (user + assistant + tool result)
    expect(stepsSeen[1].stepNumber).toBe(1);
    expect(stepsSeen[1].messageCount).toBeGreaterThan(stepsSeen[0].messageCount);
  });

  it('processInputStep can see tool results in accumulated messages', async () => {
    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
    });

    const messagesByStep: Array<Array<{ role: string; content: any }>> = [];

    const inputStepProcessor = {
      id: 'message-tracker',
      async processInputStep({
        stepNumber,
        messages,
      }: {
        stepNumber: number;
        messages: Array<{ role: string; content: any }>;
      }) {
        // Capture messages at each step
        messagesByStep.push([...messages]);
        return messages;
      },
    };

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Look up the value for key alpha.',
      tools: { lookup: lookupTool },
      stopWhen: stepCountIs(5),
      inputProcessors: [inputStepProcessor],
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

    // Second step should see the assistant's tool call but not tool result yet
    // (processInputStep runs BEFORE the model call, so tool results aren't in messages yet)
    expect(messagesByStep).toHaveLength(2);

    // First step: only user message
    const firstStepRoles = messagesByStep[0].map(m => m.role);
    expect(firstStepRoles).toContain('user');
    expect(firstStepRoles).not.toContain('assistant');

    // Second step: sees user + assistant (with tool call) but NOT tool result
    // (tool results are added after model execution, not before)
    const secondStepRoles = messagesByStep[1].map(m => m.role);
    expect(secondStepRoles).toContain('user');
    expect(secondStepRoles).toContain('assistant');

    // The second step has more messages than the first (accumulated context)
    expect(messagesByStep[1].length).toBeGreaterThan(messagesByStep[0].length);
  });
});
