import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createTool } from './tool';
import { isValidationError } from './validation';

// Reusing a tool outside an agent (a test, a script, another tool) by calling
// `tool.execute(input)` with no context. The runtime builds a minimal context with an
// empty RequestContext, a no-op `observe`, and no mastra, writer, memory, or thread IDs. (#28651)
// This runtime behavior already worked before the fix; the type-level failure is covered by
// execute-without-context.test-d.ts. These cases guard the behavior the new type exposes.
function createAddOne() {
  const seen: { requestContext?: unknown; mastra?: unknown; keys?: string[] } = {};
  const tool = createTool({
    id: 'add-one',
    description: 'Adds one',
    inputSchema: z.object({ a: z.number() }),
    outputSchema: z.number(),
    execute: async ({ a }, context) => {
      seen.requestContext = context.requestContext;
      seen.mastra = context.mastra;
      seen.keys = Object.keys(context);
      return a + 1;
    },
  });
  return { tool, seen };
}

describe('calling tool.execute() without a context (#28651)', () => {
  it('returns the tool result and hands the tool an empty request context', async () => {
    const { tool, seen } = createAddOne();

    const result = await tool.execute?.({ a: 1 });

    expect(result).toBe(2);
    expect(seen.requestContext).toBeInstanceOf(RequestContext);
    expect(seen.mastra).toBeUndefined();
    for (const key of ['writer', 'agent', 'threadId', 'resourceId', 'runId']) {
      expect(seen.keys).not.toContain(key);
    }
  });

  it('gives each context-free call a fresh, empty request context', async () => {
    const { tool, seen } = createAddOne();

    await tool.execute?.({ a: 1 });
    const first = seen.requestContext as RequestContext;
    expect(first.size()).toBe(0);
    first.set('leaked', 'from the first call');

    await tool.execute?.({ a: 2 });
    const second = seen.requestContext as RequestContext;
    expect(second).not.toBe(first);
    expect(second.size()).toBe(0);
    expect(second.get('leaked')).toBeUndefined();
  });

  it('still validates the input', async () => {
    const { tool, seen } = createAddOne();

    // @ts-expect-error deliberately invalid input exercises runtime validation
    const result = await tool.execute?.({ a: 'one' });

    expect(isValidationError(result)).toBe(true);
    expect(seen.keys).toBeUndefined();
  });
});
