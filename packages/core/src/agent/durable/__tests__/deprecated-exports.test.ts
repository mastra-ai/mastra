/**
 * Pins the deprecated pre-unification tool-execution exports on the public
 * `@mastra/core/agent/durable` entry point. They were removed when the
 * durable workflows moved onto the shared loop cores; restored as
 * deprecated so the released surface stays additive at patch level.
 */

import { describe, expect, it } from 'vitest';
import type { ToolExecutionContext, ToolExecutionError } from '../index';
import { executeDurableToolCalls } from '../index';

describe('deprecated durable tool-execution exports', () => {
  it('exports executeDurableToolCalls and its context/error types', async () => {
    expect(typeof executeDurableToolCalls).toBe('function');

    const error: ToolExecutionError = { name: 'ToolExecutionError', message: 'boom' };
    const ctx: ToolExecutionContext = {
      toolCalls: [
        { toolCallId: 'call-1', toolName: 'echo', args: { value: 'hi' } },
        { toolCallId: 'call-2', toolName: 'missing', args: {} },
      ],
      tools: {
        echo: { execute: async (args: Record<string, unknown>) => args.value },
      },
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'message-1',
      state: {},
    };

    const results = await executeDurableToolCalls(ctx);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ toolCallId: 'call-1', result: 'hi' });
    expect(results[1]).toMatchObject({
      toolCallId: 'call-2',
      error: { name: 'ToolNotFoundError', message: 'Tool missing not found' },
    });
    expect(error.message).toBe('boom');
  });
});
