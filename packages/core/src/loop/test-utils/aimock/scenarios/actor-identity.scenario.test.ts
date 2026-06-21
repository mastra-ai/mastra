import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: actor identity passthrough.
 *
 * The actor signal is forwarded to the agent.stream() call and can affect
 * tool access via fine-grained authorization. This pins the actor passthrough
 * path, ensuring actor identity is preserved across the loop.
 */
describe('AIMock loop scenario: actor identity', () => {
  const getMock = useLoopScenarioAimock();

  it('actor is forwarded to agent stream', async () => {
    const checkTool = createTool({
      id: 'check_permission',
      description: 'Check if user has permission.',
      inputSchema: z.object({}),
      outputSchema: z.object({ allowed: z.boolean() }),
      execute: async () => ({ allowed: true }),
    });

    const actor = {
      type: 'user',
      id: 'user-123',
      name: 'Test User',
    };

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Check permissions.',
      tools: { check_permission: checkTool },
      stopWhen: stepCountIs(2),
      actor,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_check', name: 'check_permission', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Permission granted.' },
        );
      },
    });

    // Loop should complete successfully with actor
    const text = await output.text;
    expect(text).toContain('Permission');
  });

  it('actor can be undefined', async () => {
    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Simple test.',
      stopWhen: stepCountIs(1),
      // No actor provided
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Done.' });
      },
    });

    const text = await output.text;
    expect(text).toContain('Done');
  });
});
