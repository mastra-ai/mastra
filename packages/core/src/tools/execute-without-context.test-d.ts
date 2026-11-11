import { describe, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createTool, Tool } from './tool';
import type { ValidationError } from './validation';

// Calling a tool directly (in a test, a script, or another tool) should not need a
// context argument, because the runtime builds a minimal one when it is left out. (#28651)
const addOne = createTool({
  id: 'add-one',
  description: 'Adds one',
  inputSchema: z.object({ a: z.number() }),
  outputSchema: z.number(),
  execute: async ({ a }) => a + 1,
});

describe('calling tool.execute() without a context (#28651)', () => {
  it('compiles a direct call that passes only the input', async () => {
    const result = await addOne.execute?.({ a: 1 });
    expectTypeOf(result).toEqualTypeOf<number | ValidationError | void | undefined>();
  });

  it('compiles a direct call on a tool built with new Tool()', async () => {
    const tool = new Tool({
      id: 'echo',
      description: 'Echoes the input',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => text,
    });
    await tool.execute?.({ text: 'hi' });
  });

  it('still type-checks a context the caller does pass', async () => {
    await addOne.execute?.({ a: 1 }, { requestContext: new RequestContext() });
    // @ts-expect-error requestContext must be a RequestContext, not a string
    await addOne.execute?.({ a: 1 }, { requestContext: 'not-a-request-context' });
  });

  it('compiles a call that forwards a context which may be undefined', async () => {
    const forward = (context?: { requestContext: RequestContext }) => addOne.execute?.({ a: 1 }, context);
    await forward();
  });

  it('keeps the context type derived from execute free of undefined', () => {
    // Helpers typed from `Parameters<Tool['execute']>[1]` read context fields directly and
    // must keep compiling after the parameter became optional for callers.
    type DerivedContext = Parameters<NonNullable<typeof addOne.execute>>[1];
    expectTypeOf<undefined>().not.toExtend<DerivedContext>();
    const readRequestContext = (context: DerivedContext) => context.requestContext;
    void readRequestContext;
  });

  // Known trade-offs of the optional parameter, pinned so a later change to the
  // signatures is deliberate.
  it('requires a replacement execute function to handle a missing context', () => {
    const tool = createTool({
      id: 'replaceable',
      description: 'Has its execute replaced',
      inputSchema: z.object({ a: z.number() }),
      execute: async ({ a }) => a,
    });
    // @ts-expect-error context may be undefined when callers omit it
    tool.execute = async (_input, context) => context.requestContext;
    tool.execute = async (_input, context) => context?.requestContext;
  });

  it('keeps the context-requiring signature for helpers that infer from the function type', () => {
    const mocked = vi.fn(addOne.execute!);
    // @ts-expect-error vi.fn() infers from the last signature, which requires a context
    void mocked({ a: 1 });
    void mocked({ a: 1 }, { requestContext: new RequestContext() });
  });

  it('still type-checks the input', async () => {
    // @ts-expect-error `a` must be a number
    await addOne.execute?.({ a: 'one' });
  });
});
