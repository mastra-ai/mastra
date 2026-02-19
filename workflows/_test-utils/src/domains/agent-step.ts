/**
 * Agent as step tests for workflows
 * Note: These tests require mock language models for full functionality
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
// @ts-ignore
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { Mastra } from '@mastra/core/mastra';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for agent step tests.
 */
export function createAgentStepWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should execute workflow with step that simulates agent behavior
  {
    const agentLikeStep = createStep({
      id: 'agent-step',
      execute: async ({ inputData }) => {
        // Simulate agent processing
        const response = `Processed: ${inputData.prompt}`;
        return { response };
      },
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ response: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'agent-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ response: z.string() }),
    });

    workflow.then(agentLikeStep).commit();

    workflows['agent-workflow'] = { workflow, mocks: {} };
  }

  // Test: should chain steps before and after agent-like step
  {
    const prepareStep = createStep({
      id: 'prepare',
      execute: async ({ inputData }) => {
        return { prompt: `Enhanced: ${inputData.input}` };
      },
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ prompt: z.string() }),
    });

    const agentLikeStep = createStep({
      id: 'agent-step',
      execute: async ({ inputData }) => {
        return { response: `AI Response to: ${inputData.prompt}` };
      },
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ response: z.string() }),
    });

    const postProcessStep = createStep({
      id: 'post-process',
      execute: async ({ inputData }) => {
        return { finalResult: inputData.response.toUpperCase() };
      },
      inputSchema: z.object({ response: z.string() }),
      outputSchema: z.object({ finalResult: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'chained-agent-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ finalResult: z.string() }),
    });

    workflow.then(prepareStep).then(agentLikeStep).then(postProcessStep).commit();

    workflows['chained-agent-workflow'] = { workflow, mocks: {} };
  }

  // Test: should handle agent step errors gracefully
  {
    const prepareStep = createStep({
      id: 'prepare',
      execute: async ({ inputData }) => {
        return { prompt: inputData.input };
      },
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ prompt: z.string() }),
    });

    const failingAgentStep = createStep({
      id: 'agent-step',
      execute: async () => {
        throw new Error('LLM API rate limit exceeded');
      },
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ response: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'failing-agent-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ response: z.string() }),
    });

    workflow.then(prepareStep).then(failingAgentStep).commit();

    workflows['failing-agent-workflow'] = { workflow, mocks: {} };
  }

  // Test: should be able to use agent-like steps in parallel
  {
    const agent1Execute = async ({ inputData }: { inputData: { prompt: string } }) => {
      // Simulate agent processing
      return { text: `Agent1 Response to: ${inputData.prompt}` };
    };

    const agent2Execute = async ({ inputData }: { inputData: { prompt: string } }) => {
      // Simulate agent processing
      return { text: `Agent2 Response to: ${inputData.prompt}` };
    };

    const agentStep1 = createStep({
      id: 'agent-step-1',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: agent1Execute,
    });

    const agentStep2 = createStep({
      id: 'agent-step-2',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: agent2Execute,
    });

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
      outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
      execute: async ({ inputData }) => ({
        prompt1: inputData.prompt1,
        prompt2: inputData.prompt2,
      }),
    });

    // Create nested workflows to wrap agent steps (simulating agent.asStep())
    const nestedWorkflow1 = createWorkflow({
      id: 'nested-agent-workflow-1',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(agentStep1)
      .commit();

    const nestedWorkflow2 = createWorkflow({
      id: 'nested-agent-workflow-2',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(agentStep2)
      .commit();

    const finalStep = createStep({
      id: 'finalStep',
      inputSchema: z.object({
        'nested-agent-workflow-1': z.object({ text: z.string() }),
        'nested-agent-workflow-2': z.object({ text: z.string() }),
      }),
      outputSchema: z.object({ combined: z.string() }),
      execute: async ({ inputData }) => ({
        combined: `${inputData['nested-agent-workflow-1'].text} | ${inputData['nested-agent-workflow-2'].text}`,
      }),
    });

    const workflow = createWorkflow({
      id: 'parallel-agents-workflow',
      inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
      outputSchema: z.object({ combined: z.string() }),
    });

    workflow
      .then(startStep)
      .map({
        prompt: { step: startStep, path: 'prompt1' },
      })
      .parallel([nestedWorkflow1, nestedWorkflow2])
      .then(finalStep)
      .commit();

    workflows['parallel-agents-workflow'] = { workflow, mocks: {} };
  }

  // Test: should execute agent-like nested workflow as a step
  {
    const agentExecute = async ({ inputData }: { inputData: { prompt: string } }) => {
      // Simulate agent processing with some "intelligence"
      const response = inputData.prompt.includes('capital')
        ? 'Paris is the capital of France'
        : `Processed: ${inputData.prompt}`;
      return { text: response };
    };

    const agentStep = createStep({
      id: 'agent-step',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: agentExecute,
    });

    // Nested workflow that wraps the agent step (simulating agent.asStep())
    const nestedAgentWorkflow = createWorkflow({
      id: 'nested-agent-as-step-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(agentStep)
      .commit();

    const prepStep = createStep({
      id: 'prep',
      inputSchema: z.object({ question: z.string() }),
      outputSchema: z.object({ prompt: z.string() }),
      execute: async ({ inputData }) => ({
        prompt: `Question: ${inputData.question}`,
      }),
    });

    const postStep = createStep({
      id: 'post',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
      execute: async ({ inputData }) => ({
        answer: inputData.text.toUpperCase(),
      }),
    });

    const workflow = createWorkflow({
      id: 'agent-nested-step-workflow',
      inputSchema: z.object({ question: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
    });

    workflow.then(prepStep).then(nestedAgentWorkflow).then(postStep).commit();

    workflows['agent-nested-step-workflow'] = { workflow, mocks: {} };
  }

  // Test: should handle agent-like step in deeply nested workflow
  {
    const agentExecute = async ({ inputData }: { inputData: { prompt: string } }) => {
      return { text: `Deep Agent Response: ${inputData.prompt}` };
    };

    const deepAgentStep = createStep({
      id: 'deep-agent-step',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: agentExecute,
    });

    // Inner nested workflow
    const innerNestedWorkflow = createWorkflow({
      id: 'inner-nested-agent-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(deepAgentStep)
      .commit();

    // Middle nested workflow that contains inner nested
    const middleStep = createStep({
      id: 'middle-step',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ prompt: z.string() }),
      execute: async ({ inputData }) => ({
        prompt: `Middle processed: ${inputData.input}`,
      }),
    });

    const middleNestedWorkflow = createWorkflow({
      id: 'middle-nested-agent-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    })
      .then(middleStep)
      .then(innerNestedWorkflow)
      .commit();

    // Outer workflow
    const outerStep = createStep({
      id: 'outer-step',
      inputSchema: z.object({ data: z.string() }),
      outputSchema: z.object({ input: z.string() }),
      execute: async ({ inputData }) => ({
        input: inputData.data,
      }),
    });

    const finalStep = createStep({
      id: 'final-step',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData }) => ({
        result: `Final: ${inputData.text}`,
      }),
    });

    const workflow = createWorkflow({
      id: 'deep-nested-agent-workflow',
      inputSchema: z.object({ data: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(outerStep).then(middleNestedWorkflow).then(finalStep).commit();

    workflows['deep-nested-agent-workflow'] = { workflow, mocks: {} };
  }

  // Test: should pass options through to agent-like step
  {
    let receivedOptions: any = null;

    const agentWithOptionsStep = createStep({
      id: 'agent-with-options',
      inputSchema: z.object({
        prompt: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        instructions: z.string().optional(),
      }),
      outputSchema: z.object({
        text: z.string(),
        receivedTemp: z.number().optional(),
        receivedMaxTokens: z.number().optional(),
        receivedInstructions: z.string().optional(),
      }),
      execute: async ({ inputData }) => {
        receivedOptions = {
          temperature: inputData.temperature,
          maxTokens: inputData.maxTokens,
          instructions: inputData.instructions,
        };
        return {
          text: `Processed with options: ${inputData.prompt}`,
          receivedTemp: inputData.temperature,
          receivedMaxTokens: inputData.maxTokens,
          receivedInstructions: inputData.instructions,
        };
      },
    });

    const workflow = createWorkflow({
      id: 'agent-options-workflow',
      inputSchema: z.object({
        prompt: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        instructions: z.string().optional(),
      }),
      outputSchema: z.object({
        text: z.string(),
        receivedTemp: z.number().optional(),
        receivedMaxTokens: z.number().optional(),
        receivedInstructions: z.string().optional(),
      }),
    });

    workflow.then(agentWithOptionsStep).commit();

    workflows['agent-options-workflow'] = {
      workflow,
      mocks: {},
      getReceivedOptions: () => receivedOptions,
      resetReceivedOptions: () => {
        receivedOptions = null;
      },
    };
  }

  return workflows;
}

export function createAgentStepTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Agent as step', () => {
    it('should execute workflow with step that simulates agent behavior', async () => {
      const { workflow } = registry!['agent-workflow']!;

      const result = await execute(workflow, { prompt: 'Hello, world!' });

      expect(result.status).toBe('success');
      expect(result.steps['agent-step']).toMatchObject({
        status: 'success',
        output: { response: 'Processed: Hello, world!' },
      });
    });

    it('should chain steps before and after agent-like step', async () => {
      const { workflow } = registry!['chained-agent-workflow']!;

      const result = await execute(workflow, { input: 'test input' });

      expect(result.status).toBe('success');
      expect(result.steps['prepare']).toMatchObject({
        status: 'success',
        output: { prompt: 'Enhanced: test input' },
      });
      expect(result.steps['agent-step']).toMatchObject({
        status: 'success',
        output: { response: 'AI Response to: Enhanced: test input' },
      });
      expect(result.steps['post-process']).toMatchObject({
        status: 'success',
        output: { finalResult: 'AI RESPONSE TO: ENHANCED: TEST INPUT' },
      });
    });

    it('should handle agent step errors gracefully', async () => {
      const { workflow } = registry!['failing-agent-workflow']!;

      const result = await execute(workflow, { input: 'test input' });

      expect(result.status).toBe('failed');
      expect(result.steps['prepare']).toMatchObject({
        status: 'success',
        output: { prompt: 'test input' },
      });
      expect(result.steps['agent-step']).toMatchObject({
        status: 'failed',
      });
      expect((result.steps['agent-step'] as any).error?.message).toMatch(/LLM API rate limit exceeded/);
    });

    it('should execute agent-like steps in parallel', async () => {
      const { workflow } = registry!['parallel-agents-workflow']!;

      const result = await execute(workflow, { prompt1: 'Hello', prompt2: 'World' });

      expect(result.status).toBe('success');
      expect(result.steps['start']).toMatchObject({
        status: 'success',
        output: { prompt1: 'Hello', prompt2: 'World' },
      });
      // Both nested agent workflows should have executed
      expect(result.steps['nested-agent-workflow-1']).toMatchObject({
        status: 'success',
      });
      expect(result.steps['nested-agent-workflow-2']).toMatchObject({
        status: 'success',
      });
      expect(result.steps['finalStep']).toMatchObject({
        status: 'success',
      });
      // Final step should have combined the results
      expect((result.steps['finalStep'] as any).output?.combined).toContain('Agent1 Response');
      expect((result.steps['finalStep'] as any).output?.combined).toContain('Agent2 Response');
    });

    it('should execute agent-like nested workflow as a step', async () => {
      const { workflow } = registry!['agent-nested-step-workflow']!;

      const result = await execute(workflow, { question: 'What is the capital of France?' });

      expect(result.status).toBe('success');
      expect(result.steps['prep']).toMatchObject({
        status: 'success',
        output: { prompt: 'Question: What is the capital of France?' },
      });
      expect(result.steps['nested-agent-as-step-workflow']).toMatchObject({
        status: 'success',
      });
      expect(result.steps['post']).toMatchObject({
        status: 'success',
      });
      // The agent recognized the "capital" keyword and responded appropriately
      expect((result.steps['post'] as any).output?.answer).toContain('PARIS');
    });

    it.skipIf(skipTests.agentStepDeepNested)('should handle agent-like step in deeply nested workflow', async () => {
      const { workflow } = registry!['deep-nested-agent-workflow']!;

      const result = await execute(workflow, { data: 'test data' });

      expect(result.status).toBe('success');
      expect(result.steps['outer-step']).toMatchObject({
        status: 'success',
        output: { input: 'test data' },
      });
      expect(result.steps['middle-nested-agent-workflow']).toMatchObject({
        status: 'success',
      });
      expect(result.steps['final-step']).toMatchObject({
        status: 'success',
      });
      // Verify the deep processing chain worked
      expect((result.steps['final-step'] as any).output?.result).toContain('Final:');
      expect((result.steps['final-step'] as any).output?.result).toContain('Deep Agent Response');
    });

    it('should pass options through to agent-like step', async () => {
      const { workflow, resetReceivedOptions } = registry!['agent-options-workflow']!;
      resetReceivedOptions?.();

      const result = await execute(workflow, {
        prompt: 'Hello agent',
        temperature: 0.7,
        maxTokens: 1000,
        instructions: 'Be helpful',
      });

      expect(result.status).toBe('success');
      expect(result.steps['agent-with-options']).toMatchObject({
        status: 'success',
      });
      // Verify the options were passed through
      const output = (result.steps['agent-with-options'] as any).output;
      expect(output.receivedTemp).toBe(0.7);
      expect(output.receivedMaxTokens).toBe(1000);
      expect(output.receivedInstructions).toBe('Be helpful');
      expect(output.text).toContain('Processed with options');
    });

    it.skipIf(skipTests.agentStepMastraInstance)(
      'should be able to use an agent as a step via mastra instance',
      async () => {
        const { createWorkflow, createStep, Agent } = ctx;

        if (!Agent) {
          // Skip if Agent class not provided
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-mastra-instance-workflow',
          inputSchema: z.object({
            prompt1: z.string(),
            prompt2: z.string(),
          }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'Paris',
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'London',
            }),
          }),
        });

        const startStep = createStep({
          id: 'start',
          inputSchema: z.object({
            prompt1: z.string(),
            prompt2: z.string(),
          }),
          outputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
          execute: async ({ inputData }) => {
            return {
              prompt1: inputData.prompt1,
              prompt2: inputData.prompt2,
            };
          },
        });

        new Mastra({
          logger: false,
          workflows: { 'agent-mastra-instance-workflow': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        });

        workflow
          .then(startStep)
          .map({
            prompt: {
              step: startStep,
              path: 'prompt1',
            },
          })
          .then(
            createStep({
              id: 'agent-step-1',
              inputSchema: z.object({ prompt: z.string() }),
              outputSchema: z.object({ text: z.string() }),
              execute: async ({ inputData, mastra }) => {
                const agent = mastra.getAgent('test-agent-1');
                const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
                return { text: result.text };
              },
            }),
          )
          .map({
            prompt: {
              step: startStep,
              path: 'prompt2',
            },
          })
          .then(
            createStep({
              id: 'agent-step-2',
              inputSchema: z.object({ prompt: z.string() }),
              outputSchema: z.object({ text: z.string() }),
              execute: async ({ inputData, mastra }) => {
                const agent = mastra.getAgent('test-agent-2');
                const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
                return { text: result.text };
              },
            }),
          )
          .commit();

        const run = await workflow.createRun();
        const result = await run.start({
          inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
        });

        expect(result.steps['agent-step-1']).toEqual({
          status: 'success',
          output: { text: 'Paris' },
          payload: {
            prompt: 'Capital of France, just the name',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });

        expect(result.steps['agent-step-2']).toEqual({
          status: 'success',
          output: { text: 'London' },
          payload: {
            prompt: 'Capital of UK, just the name',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
      },
    );

    it.skipIf(skipTests.agentStepNestedMastraInstance)(
      'should be able to use an agent as a step in nested workflow via mastra instance',
      async () => {
        const { createWorkflow, createStep, cloneStep, Agent } = ctx;

        if (!Agent || !cloneStep) {
          // Skip if Agent class or cloneStep not provided
          return;
        }

        const workflow = createWorkflow({
          id: 'agent-nested-mastra-instance-workflow',
          inputSchema: z.object({
            prompt1: z.string(),
            prompt2: z.string(),
          }),
          outputSchema: z.object({}),
        });

        const agent = new Agent({
          id: 'test-agent-1',
          name: 'test-agent-1',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'Paris',
            }),
          }),
        });

        const agent2 = new Agent({
          id: 'test-agent-2',
          name: 'test-agent-2',
          instructions: 'test agent instructions',
          model: new MockLanguageModelV1({
            doGenerate: async () => ({
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              text: 'London',
            }),
          }),
        });

        new Mastra({
          logger: false,
          workflows: { 'agent-nested-mastra-instance-workflow': workflow },
          agents: { 'test-agent-1': agent, 'test-agent-2': agent2 },
        });

        const agentStep = createStep({
          id: 'agent-step',
          inputSchema: z.object({ agentName: z.string(), prompt: z.string() }),
          outputSchema: z.object({ text: z.string() }),
          execute: async ({ inputData, mastra }) => {
            const agent = mastra.getAgent(inputData.agentName);
            const result = await agent.generateLegacy([{ role: 'user', content: inputData.prompt }]);
            return { text: result.text };
          },
        });

        const agentStep2 = cloneStep(agentStep, { id: 'agent-step-2' });

        workflow
          .then(
            createWorkflow({
              id: 'nested-workflow',
              inputSchema: z.object({ prompt1: z.string(), prompt2: z.string() }),
              outputSchema: z.object({ text: z.string() }),
            })
              .map({
                agentName: {
                  value: 'test-agent-1',
                  schema: z.string(),
                },
                prompt: {
                  initData: workflow,
                  path: 'prompt1',
                },
              })
              .then(agentStep)
              .map({
                agentName: {
                  value: 'test-agent-2',
                  schema: z.string(),
                },
                prompt: {
                  initData: workflow,
                  path: 'prompt2',
                },
              })
              .then(agentStep2)
              .then(
                createStep({
                  id: 'final-step',
                  inputSchema: z.object({ text: z.string() }),
                  outputSchema: z.object({ text: z.string() }),
                  execute: async ({ getStepResult }) => {
                    return { text: `${getStepResult(agentStep)?.text} ${getStepResult(agentStep2)?.text}` };
                  },
                }),
              )
              .commit(),
          )
          .commit();

        const run = await workflow.createRun();
        const result = await run.start({
          inputData: { prompt1: 'Capital of France, just the name', prompt2: 'Capital of UK, just the name' },
        });

        expect(result.steps['nested-workflow']).toEqual({
          status: 'success',
          output: { text: 'Paris London' },
          payload: {
            prompt1: 'Capital of France, just the name',
            prompt2: 'Capital of UK, just the name',
          },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        });
      },
    );
  });
}
