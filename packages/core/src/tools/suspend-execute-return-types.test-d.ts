import { describe, it } from 'vitest';
import { z } from 'zod';
import { createTool } from './tool';

// Regression tests for the createTool execute return type when a tool calls
// `suspend(...)`. The runtime contract is cooperative: calling `suspend`
// records the suspend payload and the execute function is expected to return
// (typically with `return await suspend(...)`), at which point the framework
// skips output validation. The type of `execute` therefore must allow `void`
// as a return alongside the declared output schema shape.

describe('createTool execute return type with suspend', () => {
  it('accepts `return await suspend(...)` when an outputSchema is declared', () => {
    createTool({
      id: 'get-weather',
      description: 'Get current weather for a location',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({
        temperature: z.number(),
        conditions: z.string(),
        location: z.string(),
      }),
      resumeSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      execute: async (inputData, context) => {
        const { resumeData: { approved } = {}, suspend } = context?.agent ?? {};
        if (!approved) {
          return suspend?.({ reason: 'Approval required.' });
        }
        return { temperature: 70, conditions: 'clear', location: inputData.location };
      },
    });
  });

  it('accepts the docs idiom (workflow.suspend) when an outputSchema is declared', () => {
    createTool({
      id: 'find-user',
      description: 'docs example with outputSchema added',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string(), email: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_inputData, { workflow }) => {
        if (!workflow?.resumeData) {
          return await workflow!.suspend({ message: 'Please provide the name of the user' });
        }
        return { name: workflow.resumeData.name, email: 'test@test.com' };
      },
    });
  });

  it('still rejects a clearly wrong return shape', () => {
    createTool({
      id: 'wrong-shape',
      description: 'returning a mismatched shape should still error',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number() }),
      // @ts-expect-error returning a string is not assignable to { temperature: number } | void
      execute: async () => 'not the right shape',
    });
  });

  it('still accepts the docs example pattern with no outputSchema', () => {
    createTool({
      id: 'find-user-no-output',
      description: 'docs example as-is',
      inputSchema: z.object({ name: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_inputData, { workflow }) => {
        if (!workflow?.resumeData) {
          return await workflow!.suspend({ message: 'Please provide the name of the user' });
        }
        return { name: workflow.resumeData.name, email: 'test@test.com' };
      },
    });
  });
});
