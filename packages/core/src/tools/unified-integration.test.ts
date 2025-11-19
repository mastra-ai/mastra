import { MockLanguageModelV2, convertArrayToReadableStream } from 'ai-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';
import { createStep, createWorkflow } from '../workflows/workflow';

import { createTool } from './tool';
import type { MastraToolInvocationOptions } from './types';

describe('Tool Unified Arguments - Real Integration Tests', () => {
  // Track what the tool receives
  let toolInputCapture: any = null;
  let toolContextCapture: any = undefined;

  // Create a test tool that captures its arguments
  const createTestTool = () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool that captures its arguments',
      inputSchema: z.object({
        text: z.string(),
        count: z.number().optional(),
      }),
      outputSchema: z.object({
        message: z.string(),
        hasWorkflowContext: z.boolean(),
        hasAgentContext: z.boolean(),
        workflowId: z.string().optional(),
        toolCallId: z.string().optional(),
      }),
      execute: async (inputData: any, context?: any) => {
        toolInputCapture = inputData;
        toolContextCapture = context;

        // Return a result based on input
        return {
          message: `Processed ${inputData.text}`,
          hasWorkflowContext: !!context?.workflow,
          hasAgentContext: !!context?.agent,
          workflowId: context?.workflow?.workflowId,
          toolCallId: context?.agent?.toolCallId,
        };
      },
    });

    // Spy on the actual execute method of the tool
    const executeSpy = vi.spyOn(tool, 'execute' as any);

    return { tool, executeSpy };
  };

  beforeEach(() => {
    toolInputCapture = null;
    toolContextCapture = undefined;
  });

  describe('Agent Tool Execution', () => {
    it('should pass raw input and agent context when tool is called by agent', async () => {
      const { tool, executeSpy } = createTestTool();

      // Create a mock model using MockLanguageModelV2 with doStream
      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'agent-call-123',
              toolName: 'test-tool',
              input: JSON.stringify({
                text: 'Hello from agent',
                count: 42,
              }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      // Create agent with the tool
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent',
        model: mockModel as any,
        tools: {
          'test-tool': tool as any,
        },
      });

      // Generate with the agent (this will call the tool)
      const result = await agent.generate('Use the test tool');
      console.log(
        'Tool results:',
        result.toolResults?.map((r: any) => r.payload),
      );

      // Verify the tool was called with correct arguments
      expect(executeSpy).toHaveBeenCalled();

      // Check that tool received raw input (not wrapped)
      expect(toolInputCapture).toEqual({
        text: 'Hello from agent',
        count: 42,
      });

      // Check that context has agent-specific properties
      expect(toolContextCapture).toBeDefined();
      expect(toolContextCapture?.agent).toBeDefined();
      expect(toolContextCapture?.agent?.toolCallId).toBe('agent-call-123');

      // Should NOT have workflow context
      expect(toolContextCapture?.workflow).toBeUndefined();
    });

    it.skip('should handle multiple tool calls from agent with consistent structure', async () => {
      const { tool, executeSpy } = createTestTool();

      const mockModel = new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'test-tool',
              input: JSON.stringify({ text: 'First call' }),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'test-tool',
              input: JSON.stringify({ text: 'Second call' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      });

      const agent = new Agent({
        id: 'multi-tool-agent',
        name: 'Multi Tool Agent',
        instructions: 'Test multiple tool calls',
        model: mockModel as any,
        tools: { 'test-tool': tool as any },
      });

      await agent.generate('Call the tool twice', { maxSteps: 1 });

      // Should be called twice (once per tool call in the same step)
      expect(executeSpy).toHaveBeenCalledTimes(2);

      // Both calls should have the same structure
      expect(executeSpy).toHaveBeenNthCalledWith(
        1,
        { text: 'First call' },
        expect.objectContaining({
          toolCallId: 'call-1',
        }),
      );

      expect(executeSpy).toHaveBeenNthCalledWith(
        2,
        { text: 'Second call' },
        expect.objectContaining({
          toolCallId: 'call-2',
        }),
      );
    });
  });

  describe('Workflow Tool Execution', () => {
    it('should pass raw input and workflow context when tool is used as workflow step', async () => {
      const { tool, executeSpy } = createTestTool();

      // Create a workflow that uses the tool as a step
      const workflow = createWorkflow({
        id: 'test-workflow',
        description: 'A test workflow',
        options: { validateInputs: false },
      });

      const prepareStep = createStep({
        id: 'prepare',
        execute: async () => ({
          text: 'Hello from workflow',
          count: 100,
        }),
      });

      const toolStep = createStep(tool as any);

      workflow.then(prepareStep).then(toolStep).commit();

      // Create and run the workflow
      const run = await workflow.createRun({
        runId: 'workflow-run-123',
      });

      const result = await run.start({});

      // Verify the tool was called
      expect(executeSpy).toHaveBeenCalled();

      // Check that tool received raw input from previous step
      expect(toolInputCapture).toEqual({
        text: 'Hello from workflow',
        count: 100,
      });

      // Check that context has workflow-specific properties
      expect(toolContextCapture).toBeDefined();
      expect(toolContextCapture?.workflow).toBeDefined();
      expect(toolContextCapture?.workflow?.runId).toBe('workflow-run-123');
      expect(toolContextCapture?.workflow?.workflowId).toBe('test-workflow');

      // Should NOT have agent context
      expect(toolContextCapture?.agent).toBeUndefined();

      // Check the workflow result output from the tool step
      expect(result.steps?.['test-tool']?.output).toEqual({
        message: 'Processed Hello from workflow',
        hasWorkflowContext: true,
        hasAgentContext: false,
        workflowId: 'test-workflow',
        toolCallId: undefined,
      });
    });

    it('should handle tool in parallel workflow steps', async () => {
      const { tool: tool1, executeSpy: spy1 } = createTestTool();
      const { tool: tool2, executeSpy: spy2 } = createTestTool();

      const workflow = createWorkflow({
        id: 'parallel-workflow',
        description: 'Test parallel execution',
        options: { validateInputs: false },
      });

      workflow.parallel([createStep(tool1 as any), createStep(tool2 as any)]).commit();

      const run = await workflow.createRun({
        runId: 'parallel-run-456',
      });

      await run.start({
        inputData: { text: 'Parallel input' },
      });

      // Both tools should be called
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();

      // Both should receive the same input
      expect(spy1).toHaveBeenCalledWith(
        { text: 'Parallel input' },
        expect.objectContaining({
          workflow: expect.objectContaining({
            runId: 'parallel-run-456',
            workflowId: 'parallel-workflow',
          }),
        }),
      );

      expect(spy2).toHaveBeenCalledWith(
        { text: 'Parallel input' },
        expect.objectContaining({
          workflow: expect.objectContaining({
            runId: 'parallel-run-456',
            workflowId: 'parallel-workflow',
          }),
        }),
      );
    });
  });

  describe('Direct Tool Execution', () => {
    it('should handle direct tool execution with minimal context', async () => {
      const { tool, executeSpy } = createTestTool();

      // Call tool directly
      await tool.execute({
        text: 'Direct call',
        count: 5,
      });

      // Tool was called with just input (context is optional)
      expect(executeSpy).toHaveBeenCalledWith({ text: 'Direct call', count: 5 });

      // Should not have agent or workflow context
      expect(toolContextCapture?.agent).toBeUndefined();
      expect(toolContextCapture?.workflow).toBeUndefined();
    });

    it('should handle direct tool execution with custom context', async () => {
      const { tool, executeSpy } = createTestTool();

      const customContext: MastraToolInvocationOptions = {
        suspend: async () => {},
        resumeData: { previousRun: 'data' },
      };

      await tool.execute({ text: 'With context' }, customContext);

      expect(executeSpy).toHaveBeenCalledWith(
        { text: 'With context' },
        expect.objectContaining({
          suspend: expect.any(Function),
          resumeData: { previousRun: 'data' },
        }),
      );
    });
  });

  describe('Type Safety', () => {
    it('should enforce type safety for tool input', async () => {
      const typedTool = createTool({
        id: 'typed-tool',
        description: 'Tool with strict types',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().min(0).max(120),
          email: z.string().email(),
        }),
        outputSchema: z.object({
          greeting: z.string(),
        }),
        execute: async (inputData, _context) => {
          // TypeScript should know the exact shape here
          const name: string = inputData.name;
          const age: number = inputData.age;
          const email: string = inputData.email;

          return {
            greeting: `Hello ${name}, age ${age}, email ${email}`,
          };
        },
      });

      // Valid input
      const result = await typedTool.execute({
        name: 'Alice',
        age: 30,
        email: 'alice@example.com',
      });

      expect(result).toEqual({
        greeting: 'Hello Alice, age 30, email alice@example.com',
      });

      // Invalid input should return validation error
      const errorResult = await typedTool.execute({
        name: 'Bob',
        age: 150, // Invalid age
        email: 'not-an-email',
      });

      expect(errorResult.error).toBe(true);
      expect(errorResult.message).toContain('validation failed');
    });

    it('should provide proper context types in execute function', async () => {
      const contextTool = createTool({
        id: 'context-typed-tool',
        description: 'Tool that uses context',
        inputSchema: z.object({ key: z.string() }),
        execute: async (inputData, context) => {
          // All context properties should be properly typed - test type safety
          context?.mastra; // Mastra | undefined
          context?.workflow?.workflowId; // string | undefined
          context?.agent?.toolCallId; // string | undefined
          context?.suspend; // ((payload: any) => Promise<any>) | undefined

          // Test type guards work
          if (context?.workflow) {
            context.workflow.runId; // string | undefined
            context.workflow.state; // Record<string, any> | undefined
          }

          if (context?.agent) {
            context.agent.messages; // any[] | undefined
          }

          return { success: true };
        },
      });

      await contextTool.execute({ key: 'test' });
    });
  });

  describe('Error Handling', () => {
    it('should return validation error for invalid input in any context', async () => {
      const { tool } = createTestTool();

      // Direct call with invalid input
      const directResult = await tool.execute({
        text: 123, // Should be string
        count: 'not a number', // Should be number
      } as any);

      expect(directResult.error).toBe(true);
      expect(directResult.message).toContain('validation failed');

      // Agent context with invalid input would be caught before tool execution
      // Workflow context with invalid input would fail at runtime
    });

    it('should handle tool execution errors gracefully', async () => {
      const errorTool = createTool({
        id: 'error-tool',
        description: 'Tool that throws',
        inputSchema: z.object({ shouldFail: z.boolean() }),
        execute: async (inputData, _context) => {
          if (inputData.shouldFail) {
            throw new Error('Tool execution failed');
          }
          return { success: true };
        },
      });

      // Success case
      const successResult = await errorTool.execute({ shouldFail: false });
      expect(successResult).toEqual({ success: true });

      // Error case
      await expect(errorTool.execute({ shouldFail: true })).rejects.toThrow('Tool execution failed');
    });
  });

  describe('Migration Examples', () => {
    it('should demonstrate migration from old to new tool structure', async () => {
      // OLD WAY (what we're migrating from):
      // Tools had to handle different wrapper formats

      // NEW WAY (v1.0):
      const newTool = createTool({
        id: 'migrated-tool',
        description: 'A migrated tool',
        inputSchema: z.object({
          data: z.string(),
        }),
        execute: async (inputData, context) => {
          // Simple, direct access to input
          const data = inputData.data; // No unwrapping needed!

          // Clean, organized context
          if (context?.workflow) {
            console.log(`Running in workflow ${context.workflow.workflowId}`);
          }
          if (context?.agent) {
            console.log(`Called by agent with ID ${context.agent.toolCallId}`);
          }

          return { processed: data.toUpperCase() };
        },
      });

      // Works consistently in all contexts
      const directResult = await newTool.execute({ data: 'test' });
      expect(directResult).toEqual({ processed: 'TEST' });
    });
  });
});
