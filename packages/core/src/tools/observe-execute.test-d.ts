import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createStep } from '../workflows';
import { createTool } from './tool';
import type { ToolObserve } from './types';
import { isValidationError } from './validation';

const testTool = createTool({
  id: 'test-tool',
  description: 'Emphasizes text',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ emphasized: z.string() }),
  execute: async ({ text }, context) => {
    expectTypeOf(context.observe).toEqualTypeOf<ToolObserve>();
    context.observe.log('info', 'emphasizing');
    return { emphasized: text.toUpperCase() };
  },
});

describe('tool execute context observe', () => {
  it('lets callers omit observe when calling execute directly', async () => {
    const requestContext = new RequestContext();
    await testTool.execute?.({ text: 'hi' }, { requestContext });
    await testTool.execute?.({ text: 'hi' }, {});
  });

  it('compiles the docs example that calls a tool from a step', () => {
    // Mirrors docs/src/content/en/docs/workflows/agents-and-tools.mdx ("Calling tools").
    createStep({
      id: 'step-2',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ emphasized: z.string() }),
      execute: async ({ inputData, requestContext }) => {
        const { text } = inputData;

        const response = await testTool.execute?.({ text }, { requestContext });

        if (!response || isValidationError(response)) {
          throw new Error('testTool did not return a result');
        }

        return {
          emphasized: response.emphasized,
        };
      },
    });
  });
});
