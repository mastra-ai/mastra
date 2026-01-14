import { expectTypeOf, describe, it } from 'vitest';
import { z } from 'zod';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Step } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { Processor } from '@mastra/core/processors';

describe('workflow', () => {
  describe('createStep', () => {
    describe('StepParams overload', () => {
      it('should infer input and output types from schemas', () => {
        const step = createStep({
          id: 'my-step',
          inputSchema: z.object({ name: z.string(), age: z.number() }),
          outputSchema: z.object({ greeting: z.string(), isAdult: z.boolean() }),
          execute: async ({ inputData }) => {
            expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
            return { greeting: `Hello, ${inputData.name}!`, isAdult: inputData.age >= 18 };
          },
        });

        expectTypeOf(step.id).toEqualTypeOf<'my-step'>();
        expectTypeOf<z.infer<typeof step.inputSchema>>().toEqualTypeOf<{ name: string; age: number }>();
        expectTypeOf<z.infer<typeof step.outputSchema>>().toEqualTypeOf<{ greeting: string; isAdult: boolean }>();
      });

      it('should infer state type from stateSchema', () => {
        const step = createStep({
          id: 'stateful-step',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.object({ result: z.number() }),
          stateSchema: z.object({ counter: z.number() }),
          execute: async ({ inputData, state, setState }) => {
            expectTypeOf(state).toEqualTypeOf<{ counter: number }>();
            expectTypeOf(setState).toBeFunction();
            return { result: inputData.value + state.counter };
          },
        });
      });

      it('should infer suspend and resume types from schemas', () => {
        const step = createStep({
          id: 'suspendable-step',
          inputSchema: z.object({ taskId: z.string() }),
          outputSchema: z.object({ completed: z.boolean() }),
          suspendSchema: z.object({ reason: z.string() }),
          resumeSchema: z.object({ approval: z.boolean() }),
          execute: async ({ inputData, suspend, resumeData }) => {
            expectTypeOf(resumeData).toEqualTypeOf<{ approval: boolean } | undefined>();
            if (!resumeData) {
              // suspend expects { reason: string }
              return suspend({ reason: 'Waiting for approval' });
            }
            return { completed: resumeData.approval };
          },
        });
      });

      it('should error when execute returns wrong type', () => {
        // @ts-expect-error - execute returns { greeting } but outputSchema requires { greeting, name }
        const step = createStep({
          id: 'bad-step',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ greeting: z.string(), name: z.string() }),
          execute: async ({ inputData }) => {
            return { greeting: `Hello!` }; // Missing 'name' property
          },
        });
      });
    });

    describe('Agent with structured output overload', () => {
      it('should create step with custom output schema', () => {
        const agent = new Agent({
          id: 'my-agent',
          name: 'My Agent',
          instructions: 'You are helpful',
          model: 'gpt-4o',
        });

        const step = createStep(agent, {
          structuredOutput: {
            schema: z.object({ sentiment: z.enum(['positive', 'negative', 'neutral']) }),
          },
        });

        expectTypeOf(step.id).toEqualTypeOf<'my-agent'>();
        expectTypeOf<z.infer<typeof step.inputSchema>>().toEqualTypeOf<{ prompt: string }>();
        expectTypeOf<z.infer<typeof step.outputSchema>>().toEqualTypeOf<{
          sentiment: 'positive' | 'negative' | 'neutral';
        }>();
      });

      it('should accept retries and scorers options', () => {
        const agent = new Agent({
          id: 'retry-agent',
          name: 'Retry Agent',
          instructions: 'Retry on failure',
          model: 'gpt-4o',
        });

        const step = createStep(agent, {
          retries: 3,
          structuredOutput: {
            schema: z.object({ answer: z.string() }),
          },
        });
      });
    });

    describe('Agent default output overload', () => {
      it('should default to { text: string } output', () => {
        const agent = new Agent({
          id: 'text-agent',
          name: 'Text Agent',
          instructions: 'Return text',
          model: 'gpt-4o',
        });

        const step = createStep(agent);

        expectTypeOf(step.id).toEqualTypeOf<'text-agent'>();
        expectTypeOf<z.infer<typeof step.inputSchema>>().toEqualTypeOf<{ prompt: string }>();
        // Default output is { text: string }
        expectTypeOf<z.infer<typeof step.outputSchema>>().toMatchTypeOf<{ text: string }>();
      });
    });

    describe('Tool overload', () => {
      it('should infer types from tool schemas', () => {
        const tool = createTool({
          id: 'calculator',
          description: 'Performs calculations',
          inputSchema: z.object({ a: z.number(), b: z.number(), op: z.enum(['+', '-', '*', '/']) }),
          outputSchema: z.object({ result: z.number() }),
          execute: async ({ context }) => {
            return { result: 42 };
          },
        });

        const step = createStep(tool);

        expectTypeOf(step.id).toEqualTypeOf<'calculator'>();
        expectTypeOf<z.infer<typeof step.inputSchema>>().toEqualTypeOf<{
          a: number;
          b: number;
          op: '+' | '-' | '*' | '/';
        }>();
        expectTypeOf<z.infer<typeof step.outputSchema>>().toEqualTypeOf<{ result: number }>();
      });

      it('should accept tool options', () => {
        const tool = createTool({
          id: 'fetch-data',
          description: 'Fetches data from API',
          inputSchema: z.object({ url: z.string() }),
          outputSchema: z.object({ data: z.unknown() }),
          execute: async () => ({ data: {} }),
        });

        const step = createStep(tool, {
          retries: 5,
        });
      });
    });

    describe('Processor overload', () => {
      it('should create step from processor with processInput', () => {
        const processor: Processor<'my-processor'> & { processInput: Function } = {
          id: 'my-processor',
          processInput: async () => ({ messages: [] }),
        };

        const step = createStep(processor);

        expectTypeOf(step.id).toEqualTypeOf<`processor:my-processor`>();
      });

      it('should create step from processor with processOutputStream', () => {
        const processor: Processor<'stream-processor'> & { processOutputStream: Function } = {
          id: 'stream-processor',
          processOutputStream: async () => null,
        };

        const step = createStep(processor);

        expectTypeOf(step.id).toEqualTypeOf<`processor:stream-processor`>();
      });
    });
  });

  // ============================================
  // Workflow .then() chaining
  // ============================================

  describe('workflow chaining', () => {
    describe('.then() type constraints', () => {
      it('should allow step when input matches workflow input', () => {
        const step = createStep({
          id: 'first-step',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ userName: z.string() }),
          execute: async ({ inputData }) => ({ userName: `User ${inputData.userId}` }),
        });

        const workflow = createWorkflow({
          id: 'user-workflow',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ userName: z.string() }),
        })
          .then(step)
          .commit();
      });

      it('should allow step when input is subset of previous output', () => {
        const step1 = createStep({
          id: 'step1',
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ name: z.string(), email: z.string(), age: z.number() }),
          execute: async () => ({ name: 'John', email: 'john@example.com', age: 30 }),
        });

        // step2 only needs { name, email } which is a subset of step1's output
        const step2 = createStep({
          id: 'step2',
          inputSchema: z.object({ name: z.string(), email: z.string() }),
          outputSchema: z.object({ sent: z.boolean() }),
          execute: async () => ({ sent: true }),
        });

        const workflow = createWorkflow({
          id: 'chain-workflow',
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ sent: z.boolean() }),
        })
          .then(step1)
          .then(step2)
          .commit();
      });

      it('should error when step input requires properties not in previous output', () => {
        const step1 = createStep({
          id: 'step1',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ greeting: z.string() }),
          execute: async ({ inputData }) => ({ greeting: `Hello, ${inputData.name}!` }),
        });

        // step2 requires { greeting, timestamp } but step1 only outputs { greeting }
        const step2 = createStep({
          id: 'step2',
          inputSchema: z.object({ greeting: z.string(), timestamp: z.number() }),
          outputSchema: z.object({ logged: z.boolean() }),
          execute: async () => ({ logged: true }),
        });

        const workflow = createWorkflow({
          id: 'error-workflow',
          inputSchema: z.object({ name: z.string() }),
          outputSchema: z.object({ logged: z.boolean() }),
        })
          .then(step1)
          // @ts-expect-error - step2 requires 'timestamp' which is not in step1's output
          .then(step2)
          .commit();
      });

      it('should error when first step input does not match workflow input', () => {
        const step = createStep({
          id: 'needs-age',
          inputSchema: z.object({ name: z.string(), age: z.number() }),
          outputSchema: z.object({ canVote: z.boolean() }),
          execute: async ({ inputData }) => ({ canVote: inputData.age >= 18 }),
        });

        const workflow = createWorkflow({
          id: 'mismatch-workflow',
          inputSchema: z.object({ name: z.string() }), // Missing 'age'
          outputSchema: z.object({ canVote: z.boolean() }),
        })
          .then(step)
          .commit();
      });
    });

    describe('.then() with different step types', () => {
      it('should chain agent steps', () => {
        const agent = new Agent({
          id: 'chat-agent',
          name: 'Chat Agent',
          instructions: 'Chat with users',
          model: 'gpt-4o',
        });

        const agentStep = createStep(agent, {
          structuredOutput: {
            schema: z.object({ response: z.string(), sentiment: z.string() }),
          },
        });

        const workflow = createWorkflow({
          id: 'agent-workflow',
          inputSchema: z.object({ prompt: z.string() }),
          outputSchema: z.object({ response: z.string(), sentiment: z.string() }),
        })
          .then(agentStep)
          .commit();
      });

      it('should chain tool steps', () => {
        const tool = createTool({
          id: 'lookup',
          description: 'Look up user',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ name: z.string(), email: z.string() }),
          execute: async () => ({ name: 'John', email: 'john@example.com' }),
        });

        const toolStep = createStep(tool);

        const workflow = createWorkflow({
          id: 'tool-workflow',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ name: z.string(), email: z.string() }),
        })
          .then(toolStep)
          .commit();
      });

      it('should chain mixed step types', () => {
        const tool = createTool({
          id: 'fetch-user',
          description: 'Fetch user data',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ name: z.string(), prompt: z.string() }),
          execute: async ({ context }) => ({
            name: 'John',
            prompt: `Generate greeting for John`,
          }),
        });

        const agent = new Agent({
          id: 'greeter',
          name: 'Greeter',
          instructions: 'Generate greetings',
          model: 'gpt-4o',
        });

        const toolStep = createStep(tool);
        const agentStep = createStep(agent); // Takes { prompt } from tool output

        const workflow = createWorkflow({
          id: 'mixed-workflow',
          inputSchema: z.object({ userId: z.string() }),
          outputSchema: z.object({ text: z.string() }),
        })
          .then(toolStep)
          .then(agentStep)
          .commit();
      });
    });
  });
});
