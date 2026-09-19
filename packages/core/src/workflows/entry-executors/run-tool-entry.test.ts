import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools/tool';
import { runToolEntry } from './run-tool-entry';
import type { EntryExecuteContext } from './types';

describe('declarative tool execution context', () => {
  it('supplies observe to real tools while preserving the workflow context', async () => {
    const requestContext = new RequestContext();
    const abortSignal = new AbortController().signal;
    const suspend = vi.fn();
    const setState = vi.fn();
    const execute = vi.fn(async (input: { count: number }, context: any) => {
      context.observe.log('info', 'Counting');
      return context.observe.span('count', () => ({ count: input.count + 1 }));
    });
    const tool = createTool({
      id: 'count',
      description: 'Count',
      inputSchema: z.object({ count: z.number() }),
      execute,
    });
    const ctx = {
      inputData: { count: 4 },
      requestContext,
      abortSignal,
      suspend,
      setState,
      runId: 'run',
      workflowId: 'workflow',
      state: { value: 3 },
      resumeData: { approved: true },
      actor: { actorKind: 'system', propagate: true },
    } as unknown as EntryExecuteContext;
    await expect(runToolEntry({ type: 'tool', id: 'count-step', toolId: tool.id, tool }, ctx)).resolves.toEqual({
      count: 5,
    });
    const received = execute.mock.calls[0]![1];
    expect(received.requestContext).toBe(requestContext);
    expect(received.abortSignal).toBe(abortSignal);
    expect(received.actor).toEqual(ctx.actor);
    expect(received.workflow).toEqual({
      runId: 'run',
      workflowId: 'workflow',
      state: { value: 3 },
      resumeData: { approved: true },
      suspend: expect.any(Function),
      setState,
    });
    received.workflow.suspend({ reason: 'review' });
    expect(suspend).toHaveBeenCalledWith({ reason: 'review' }, undefined);
  });

  it('preserves failures thrown inside observed tool work', async () => {
    const failure = new Error('work failed');
    const tool = createTool({
      id: 'fail',
      description: 'Fail',
      inputSchema: z.object({}),
      execute: async (_input, context) =>
        context!.observe.span('fail', () => {
          throw failure;
        }),
    });
    const ctx = {
      inputData: {},
      requestContext: new RequestContext(),
      abortSignal: new AbortController().signal,
      runId: 'run',
      workflowId: 'workflow',
    } as unknown as EntryExecuteContext;
    await expect(runToolEntry({ type: 'tool', id: 'fail-step', toolId: tool.id, tool }, ctx)).rejects.toBe(failure);
  });
});
