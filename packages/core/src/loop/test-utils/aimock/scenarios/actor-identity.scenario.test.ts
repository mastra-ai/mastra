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

  it('actor is forwarded into the tool execution context', async () => {
    let capturedActor: unknown = 'unset';

    const checkTool = createTool({
      id: 'check_permission',
      description: 'Check if user has permission.',
      inputSchema: z.object({}),
      outputSchema: z.object({ allowed: z.boolean() }),
      execute: async (_, context) => {
        capturedActor = (context as { actor?: unknown })?.actor;
        return { allowed: true };
      },
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
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Permission granted.' });
      },
    });

    // The exact actor passed to the stream must reach the tool execution
    // context. If actor passthrough regresses, capturedActor stays 'unset'.
    expect(capturedActor).toMatchObject(actor);

    const text = await output.text;
    expect(text).toContain('Permission');
  });

  it('tool context has no actor when none is provided', async () => {
    let capturedActor: unknown = 'unset';

    const checkTool = createTool({
      id: 'check_permission_no_actor',
      description: 'Captures actor when none is provided.',
      inputSchema: z.object({}),
      outputSchema: z.object({ allowed: z.boolean() }),
      execute: async (_, context) => {
        capturedActor = (context as { actor?: unknown })?.actor;
        return { allowed: true };
      },
    });

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Simple test.',
      tools: { check_permission_no_actor: checkTool },
      stopWhen: stepCountIs(2),
      // No actor provided
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_noactor', name: 'check_permission_no_actor', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    // The tool ran (so we know the assertion was reached) and saw no actor.
    expect(capturedActor).toBeUndefined();

    const text = await output.text;
    expect(text).toContain('Done');
  });
});
