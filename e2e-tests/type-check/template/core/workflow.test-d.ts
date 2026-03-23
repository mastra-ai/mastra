import { expectTypeOf, describe, it } from 'vitest';
import { z as zv3 } from 'zod-v3';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { Step, DefaultEngineType } from '@mastra/core/workflows';
import { Agent, MastraDBMessage } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { Processor, ProcessorStepInputSchema, ProcessorStepOutputSchema } from '@mastra/core/processors';

describe('workflow', () => {
  describe('createStep', () => {
    describe('StepParams overload', () => {
      it('should infer input and output types from schemas', () => {
        const step = createStep({
          id: 'my-step',
          inputSchema: zv3.object({ name: zv3.string(), age: zv3.number() }),
          outputSchema: zv3.object({ greeting: zv3.string(), isAdult: zv3.boolean() }),
          execute: async ({ inputData }) => {
            expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
            return { greeting: `Hello, ${inputData.name}!`, isAdult: inputData.age >= 18 };
          },
        });

        expectTypeOf(step.id).toEqualTypeOf<'my-step'>();
        expectTypeOf<zv3.infer<typeof step.inputSchema>>().toEqualTypeOf<{ name: string; age: number }>();
        expectTypeOf<zv3.infer<typeof step.outputSchema>>().toEqualTypeOf<{ greeting: string; isAdult: boolean }>();
      });

      it('should infer state type from stateSchema', () => {
        const step = createStep({
          id: 'stateful-step',
          inputSchema: zv3.object({ value: zv3.number() }),
          outputSchema: zv3.object({ result: zv3.number() }),
          stateSchema: zv3.object({ counter: zv3.number() }),
          execute: async ({ inputData, state, setState }) => {
            expectTypeOf(state).toEqualTypeOf<{ counter: number }>();
            expectTypeOf(setState).toBeFunction();
            expectTypeOf(setState).toBeCallableWith({ counter: 1 });
            return { result: inputData.value + state.counter };
          },
        });
      });

      it('should infer suspend and resume types from schemas', () => {
        const step = createStep({
          id: 'suspendable-step',
          inputSchema: zv3.object({ taskId: zv3.string() }),
          outputSchema: zv3.object({ completed: zv3.boolean() }),
          suspendSchema: zv3.object({ reason: zv3.string() }),
          resumeSchema: zv3.object({ approval: zv3.boolean() }),
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

      it('should allow bail() to accept any type, not just the step output type', () => {
        const step = createStep({
          id: 'bail-step',
          inputSchema: zv3.object({ value: zv3.string() }),
          outputSchema: zv3.object({ result: zv3.string() }),
          execute: async ({ bail, inputData }) => {
            if (inputData.value === 'stop') {
              // bail() should accept any type since it bails the workflow, not the step
              return bail({ workflowResult: 123 });
            }
            if (inputData.value === 'empty') {
              return bail();
            }
            return { result: inputData.value };
          },
        });
      });

      it('should error when execute returns wrong type', () => {
        const step = createStep({
          id: 'bad-step',
          inputSchema: zv3.object({ name: zv3.string() }),
          outputSchema: zv3.object({ greeting: zv3.string(), name: zv3.string() }),
          // @ts-expect-error - Return type is missing required 'name' property
          execute: async () => {
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
            schema: zv3.object({ sentiment: zv3.enum(['positive', 'negative', 'neutral']) }),
          },
        });

        expectTypeOf(step.id).toEqualTypeOf<'my-agent'>();
        expectTypeOf<zv3.infer<typeof step.inputSchema>>().toEqualTypeOf<{ prompt: string }>();
        expectTypeOf<zv3.infer<typeof step.outputSchema>>().toEqualTypeOf<{
          sentiment: 'positive' | 'negative' | 'neutral';
        }>();
        expectTypeOf(step).toEqualTypeOf<
          Step<
            'my-agent',
            unknown,
            { prompt: string },
            { sentiment: 'positive' | 'negative' | 'neutral' },
            unknown,
            unknown,
            DefaultEngineType
          >
        >();
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
            schema: zv3.object({ answer: zv3.string() }),
          },
        });

        expectTypeOf(step).toEqualTypeOf<
          Step<'retry-agent', unknown, { prompt: string }, { answer: string }, unknown, unknown, DefaultEngineType>
        >();
      });

      it('should accept retries and scorers options without structured output', () => {
        const agent = new Agent({
          id: 'retry-agent',
          description: 'Retry on failure',
          name: 'Retry Agent',
          instructions: 'Retry on failure',
          model: 'gpt-4o',
        });

        const step = createStep(agent, {
          retries: 3,
        });

        expectTypeOf(step).toEqualTypeOf<
          Step<'retry-agent', unknown, { prompt: string }, { text: string }, unknown, unknown, DefaultEngineType>
        >();
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

        expectTypeOf<zv3.infer<typeof step.inputSchema>>().toEqualTypeOf<{ prompt: string }>();
        // Default output is { text: string }
        expectTypeOf<zv3.infer<typeof step.outputSchema>>().toEqualTypeOf<{ text: string }>();
        expectTypeOf(step).toEqualTypeOf<
          Step<'text-agent', unknown, { prompt: string }, { text: string }, unknown, unknown, DefaultEngineType>
        >();
      });
    });

    describe('Tool overload', () => {
      it('should infer types from tool schemas', () => {
        const tool = createTool({
          id: 'calculator',
          description: 'Performs calculations',
          inputSchema: zv3.object({ a: zv3.number(), b: zv3.number(), op: zv3.enum(['+', '-', '*', '/']) }),
          outputSchema: zv3.object({ result: zv3.number() }),
          execute: async inputData => {
            return { result: 42 };
          },
        });

        const step = createStep(tool);

        expectTypeOf(step.id).toEqualTypeOf<'calculator'>();
        expectTypeOf<zv3.infer<typeof step.inputSchema>>().toEqualTypeOf<{
          a: number;
          b: number;
          op: '+' | '-' | '*' | '/';
        }>();
        expectTypeOf<zv3.infer<typeof step.outputSchema>>().toEqualTypeOf<{ result: number }>();
        expectTypeOf(step).toEqualTypeOf<
          Step<
            'calculator',
            unknown,
            { a: number; b: number; op: '+' | '-' | '*' | '/' },
            { result: number },
            unknown,
            unknown,
            DefaultEngineType
          >
        >();
      });

      it('should accept tool options', () => {
        const tool = createTool({
          id: 'fetch-data',
          description: 'Fetches data from API',
          inputSchema: zv3.object({ url: zv3.string() }),
          outputSchema: zv3.object({ data: zv3.unknown() }),
          execute: async () => ({ data: {} }),
        });

        const step = createStep(tool, {
          retries: 5,
        });
        expectTypeOf(step).toEqualTypeOf<
          Step<'fetch-data', unknown, { url: string }, { data?: unknown }, unknown, unknown, DefaultEngineType>
        >();
      });
    });

    describe('Processor overload', () => {
      it('should create step from processor with processInput', () => {
        const processor = new (class TestProcessor implements Processor<'test'> {
          readonly id = 'test';
          readonly name = 'Test';

          constructor() {}

          processInput(): MastraDBMessage[] {
            return [
              {
                id: 'msg-123',
                role: 'user',
                createdAt: new Date(),
                content: {
                  format: 2,
                  parts: [
                    {
                      type: 'text',
                      text: 'yo',
                    },
                  ],
                },
              },
            ];
          }
        })();

        const step = createStep(processor);
        expectTypeOf(step).toEqualTypeOf<
          Step<
            'processor:test',
            unknown,
            zv3.infer<typeof ProcessorStepInputSchema>,
            zv3.infer<typeof ProcessorStepOutputSchema>,
            unknown,
            unknown,
            DefaultEngineType
          >
        >();
      });

      it('should create step from processor with processOutputStream', () => {
        const processor: Processor<'stream-processor'> & { processOutputStream: Function } = {
          id: 'stream-processor',
          processOutputStream: async () => null,
        };

        const step = createStep(processor);
        expectTypeOf(step).toEqualTypeOf<
          Step<
            'processor:stream-processor',
            unknown,
            zv3.infer<typeof ProcessorStepInputSchema>,
            zv3.infer<typeof ProcessorStepOutputSchema>,
            unknown,
            unknown,
            DefaultEngineType
          >
        >();
      });
    });
  });

  describe('workflow chaining', () => {
    describe('.then() type constraints', () => {
      it('should allow step when input matches workflow input', () => {
        const step = createStep({
          id: 'first-step',
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ userName: zv3.string() }),
          execute: async ({ inputData }) => ({ userName: `User ${inputData.userId}` }),
        });

        const workflow = createWorkflow({
          id: 'user-workflow',
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ userName: zv3.string() }),
        })
          .then(step)
          .commit();
      });

      it('should allow step when input is subset of previous output', () => {
        const step1 = createStep({
          id: 'step1',
          inputSchema: zv3.object({ id: zv3.string() }),
          outputSchema: zv3.object({ name: zv3.string(), email: zv3.string(), age: zv3.number() }),
          execute: async () => ({ name: 'John', email: 'john@example.com', age: 30 }),
        });

        // step2 only needs { name, email } which is a subset of step1's output
        const step2 = createStep({
          id: 'step2',
          inputSchema: zv3.object({ name: zv3.string(), email: zv3.string() }),
          outputSchema: zv3.object({ sent: zv3.boolean() }),
          execute: async () => ({ sent: true }),
        });

        const workflow = createWorkflow({
          id: 'chain-workflow',
          inputSchema: zv3.object({ id: zv3.string() }),
          outputSchema: zv3.object({ sent: zv3.boolean() }),
        })
          .then(step1)
          .then(step2)
          .commit();
      });

      it('should error when step input requires properties not in previous output', () => {
        const step1 = createStep({
          id: 'step1',
          inputSchema: zv3.object({ name: zv3.string() }),
          outputSchema: zv3.object({ greeting: zv3.string() }),
          execute: async ({ inputData }) => ({ greeting: `Hello, ${inputData.name}!` }),
        });

        // step2 requires { greeting, timestamp } but step1 only outputs { greeting }
        const step2 = createStep({
          id: 'step2',
          inputSchema: zv3.object({ greeting: zv3.string(), timestamp: zv3.number() }),
          outputSchema: zv3.object({ logged: zv3.boolean() }),
          execute: async () => ({ logged: true }),
        });

        const workflow = createWorkflow({
          id: 'error-workflow',
          inputSchema: zv3.object({ name: zv3.string() }),
          outputSchema: zv3.object({ logged: zv3.boolean() }),
        })
          .then(step1)
          // @ts-expect-error - step2 requires 'timestamp' which is not in step1's output
          .then(step2)
          .commit();
      });

      it('should error when first step input does not match workflow input', () => {
        const step = createStep({
          id: 'needs-age',
          inputSchema: zv3.object({ name: zv3.string(), age: zv3.number() }),
          outputSchema: zv3.object({ canVote: zv3.boolean() }),
          execute: async ({ inputData }) => ({ canVote: inputData.age >= 18 }),
        });

        const workflow = createWorkflow({
          id: 'mismatch-workflow',
          inputSchema: zv3.object({ name: zv3.string() }), // Missing 'age'
          outputSchema: zv3.object({ canVote: zv3.boolean() }),
        })
          // @ts-expect-error - step input requires 'age' which is not in workflow input
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
            schema: zv3.object({ response: zv3.string(), sentiment: zv3.string() }),
          },
        });

        const workflow = createWorkflow({
          id: 'agent-workflow',
          inputSchema: zv3.object({ prompt: zv3.string() }),
          outputSchema: zv3.object({ response: zv3.string(), sentiment: zv3.string() }),
        })
          .then(agentStep)
          .commit();
      });

      it('should chain tool steps', () => {
        const tool = createTool({
          id: 'lookup',
          description: 'Look up user',
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ name: zv3.string(), email: zv3.string() }),
          execute: async () => ({ name: 'John', email: 'john@example.com' }),
        });

        const toolStep = createStep(tool);

        const workflow = createWorkflow({
          id: 'tool-workflow',
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ name: zv3.string(), email: zv3.string() }),
        })
          .then(toolStep)
          .commit();
      });

      it('should chain mixed step types', () => {
        const tool = createTool({
          id: 'fetch-user',
          description: 'Fetch user data',
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ name: zv3.string(), prompt: zv3.string() }),
          execute: async inputData => ({
            name: 'John',
            prompt: `Generate greeting for John ${inputData.userId}`,
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
          inputSchema: zv3.object({ userId: zv3.string() }),
          outputSchema: zv3.object({ text: zv3.string() }),
        })
          .then(toolStep)
          .then(agentStep)
          .commit();
      });
    });
  });
});
