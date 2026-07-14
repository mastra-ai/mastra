/**
 * Verifies that `${stepResults.<stepId>}` (no subpath) is accepted at
 * definition time and renders the step's scalar output at runtime.
 *
 * Also verifies that non-primitive step outputs still throw at runtime
 * when referenced without a subpath.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';

const stringTool = createTool({
  id: 'echo-str',
  description: 'Returns a plain string',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => 'hello world',
});

const objectTool = createTool({
  id: 'echo-obj',
  description: 'Returns an object',
  inputSchema: z.object({}),
  outputSchema: z.object({ value: z.string() }),
  execute: async () => ({ value: 'nested' }),
});

describe('template ${stepResults.<stepId>} (no subpath)', () => {
  it('accepts a bare stepResults reference at definition time', () => {
    expect(() =>
      createWorkflow({
        id: 'accepts-bare',
        inputSchema: z.object({}),
        outputSchema: z.object({ message: z.string() }),
      })
        .tool(stringTool)
        .map({
          message: { template: 'The value is ${stepResults.echo-str}' },
        })
        .commit(),
    ).not.toThrow();
  });

  it('rejects a bare stepResults with no step id at definition time', () => {
    expect(() =>
      createWorkflow({
        id: 'rejects-empty',
        inputSchema: z.object({}),
        outputSchema: z.object({ message: z.string() }),
      })
        .tool(stringTool)
        .map({
          message: { template: 'bad ${stepResults.}' },
        })
        .commit(),
    ).toThrow(/stepResults\.<stepId>/);
  });

  it('renders a scalar step output when referenced with no subpath', async () => {
    const wf = createWorkflow({
      id: 'scalar-render',
      inputSchema: z.object({}),
      outputSchema: z.object({ message: z.string() }),
    })
      .tool(stringTool)
      .map({
        message: { template: 'The value is ${stepResults.echo-str}' },
      })
      .commit();

    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-str': stringTool } as any,
      workflows: { 'scalar-render': wf } as any,
      storage: new InMemoryStore({ id: 'scalar-render' }),
    });
    wf.__registerMastra(mastra);

    const run = await mastra.getWorkflow('scalar-render').createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ message: 'The value is hello world' });
    }
  });

  it('throws at runtime when a bare stepResults reference resolves to an object', async () => {
    const wf = createWorkflow({
      id: 'object-render',
      inputSchema: z.object({}),
      outputSchema: z.object({ message: z.string() }),
    })
      .tool(objectTool)
      .map({
        message: { template: 'nope ${stepResults.echo-obj}' },
      })
      .commit();

    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-obj': objectTool } as any,
      workflows: { 'object-render': wf } as any,
      storage: new InMemoryStore({ id: 'object-render' }),
    });
    wf.__registerMastra(mastra);

    const run = await mastra.getWorkflow('object-render').createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      const err: any = result.error;
      const msg = typeof err === 'string' ? err : (err?.message ?? JSON.stringify(err));
      expect(msg).toMatch(/resolved to an object\/array/);
    }
  });
});
