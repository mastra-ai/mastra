/**
 * Verifies that `${stepResults.<stepId>}` (no subpath) is accepted at
 * definition time and renders the step's scalar output at runtime.
 *
 * Also verifies that object/array step outputs are JSON-stringified when
 * referenced without a subpath — this is what makes `foreach(agent)`
 * output ({ text: string }[]) usable directly in a downstream template.
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

const arrayTool = createTool({
  id: 'echo-arr',
  description: 'Returns an array of objects like a foreach(agent) result',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({ text: z.string() })),
  execute: async () => [{ text: 'first summary' }, { text: 'second summary' }],
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

  it('JSON-stringifies an object step output when referenced with no subpath', async () => {
    const wf = createWorkflow({
      id: 'object-render',
      inputSchema: z.object({}),
      outputSchema: z.object({ message: z.string() }),
    })
      .tool(objectTool)
      .map({
        message: { template: 'The object is ${stepResults.echo-obj}' },
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

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ message: 'The object is {"value":"nested"}' });
    }
  });

  it('JSON-stringifies an array step output (foreach(agent)-like shape) when referenced with no subpath', async () => {
    const wf = createWorkflow({
      id: 'array-render',
      inputSchema: z.object({}),
      outputSchema: z.object({ message: z.string() }),
    })
      .tool(arrayTool)
      .map({
        message: { template: 'Summaries: ${stepResults.echo-arr}' },
      })
      .commit();

    const mastra = new Mastra({
      logger: false,
      tools: { 'echo-arr': arrayTool } as any,
      workflows: { 'array-render': wf } as any,
      storage: new InMemoryStore({ id: 'array-render' }),
    });
    wf.__registerMastra(mastra);

    const run = await mastra.getWorkflow('array-render').createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({
        message: 'Summaries: [{"text":"first summary"},{"text":"second summary"}]',
      });
    }
  });
});
