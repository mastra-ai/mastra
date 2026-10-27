import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { AnySpan } from '../observability';
import { RequestContext } from '../request-context';
import { createStep, createWorkflow } from '../workflows';
import { createTool } from './tool';

function createObservingTool() {
  return createTool({
    id: 'observing-tool',
    description: 'Logs and wraps work in a span',
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ emphasized: z.string() }),
    execute: async ({ text }, { observe }) => {
      observe.log('info', 'emphasizing', { text });
      const emphasized = await observe.span('emphasize', () => text.toUpperCase());
      return { emphasized };
    },
  });
}

describe('tool observe outside agent execution', () => {
  it('provides observe when execute is called directly', async () => {
    const tool = createObservingTool();

    const result = await tool.execute({ text: 'hi' }, { requestContext: new RequestContext() });

    expect(result).toEqual({ emphasized: 'HI' });
  });

  it('creates child spans from the caller tracing span on direct execute', async () => {
    const tool = createObservingTool();
    const childSpan = { end: vi.fn(), error: vi.fn(), executeInContext: vi.fn(async (fn: () => unknown) => fn()) };
    const span = {
      isValid: true,
      observabilityInstance: { getLoggerContext: vi.fn(() => undefined) },
      createChildSpan: vi.fn(() => childSpan),
    } as unknown as AnySpan;

    const result = await tool.execute(
      { text: 'hi' },
      { requestContext: new RequestContext(), tracingContext: { currentSpan: span } },
    );

    expect(result).toEqual({ emphasized: 'HI' });
    expect(span.createChildSpan).toHaveBeenCalledWith(expect.objectContaining({ name: 'emphasize' }));
    expect(childSpan.end).toHaveBeenCalledWith({ output: 'HI' });
  });

  it('provides observe when the tool runs as a createStep(tool) workflow step', async () => {
    const tool = createObservingTool();
    const workflow = createWorkflow({
      id: 'observing-tool-workflow',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ emphasized: z.string() }),
    })
      .then(createStep(tool))
      .commit();

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { text: 'hi' } });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ emphasized: 'HI' });
    }
  });
});
