import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Tool } from './tool';
import type { ToolExecutionContext, MastraToolInvocationOptions } from './types';
import type { RuntimeContext } from '../runtime-context';
import type { StepExecutionContext } from '../workflows/legacy/types';

describe('Unified Tool Argument Structure', () => {
  // Define a simple tool schema
  const userSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email().optional(),
  });

  // Create a test tool that logs what it receives
  const createTestTool = () => {
    const executeSpy = vi.fn(async (input: unknown, context?: any) => {
      // This is what the tool author writes - they should receive the same structure
      // regardless of execution context
      return {
        received: input,
        // Tool authors should be able to access args directly without unwrapping
        userName: (input as any).name,
        userAge: (input as any).age,
        userEmail: (input as any).email,
      };
    });

    return {
      tool: new Tool({
        id: 'test-tool',
        description: 'Test tool for unified arguments',
        inputSchema: userSchema,
        outputSchema: z.object({
          received: z.any(),
          userName: z.string(),
          userAge: z.number(),
          userEmail: z.string().optional(),
        }),
        execute: executeSpy,
      }),
      executeSpy,
    };
  };

  describe('BREAKING CHANGE: Tool authors should receive consistent input structure', () => {
    const testInput = {
      name: 'Alice',
      age: 30,
      email: 'alice@example.com',
    };

    it('should provide same argument structure for direct agent/LLM execution', async () => {
      const { tool, executeSpy } = createTestTool();

      // In v1.0, agent/LLM loop must pass raw input as first arg
      const options: MastraToolInvocationOptions = {
        toolCallId: 'call-123',
        messages: [],
        writableStream: undefined,
        suspend: async () => {},
        resumeData: undefined,
        tracingContext: {},
      };

      // Execute tool with raw input and options
      await tool.execute(testInput, options);

      // EXPECTED: Tool author should receive the input data as first param
      // and context as second param with agent-specific properties nested
      expect(executeSpy).toHaveBeenCalledWith(testInput, expect.objectContaining({
        agent: expect.objectContaining({
          toolCallId: 'call-123',
          messages: [],
        }),
        runtimeContext: expect.any(Object),
        suspend: expect.any(Function),
      }));
    });

    it('should provide same argument structure for workflow step execution', async () => {
      const { tool, executeSpy } = createTestTool();

      // In v1.0, workflow must pass raw input as first arg
      const workflowContext: any = {
        mastra: undefined,
        runtimeContext: {} as RuntimeContext,
        tracingContext: {},
        suspend: async () => {},
        resumeData: undefined,
        workflow: {
          runId: 'workflow-run-1',
          workflowId: 'my-workflow',
        },
      };

      await tool.execute(testInput, workflowContext);

      // EXPECTED: Tool author should receive the input data as first param
      // and context as second param with workflow properties nested
      expect(executeSpy).toHaveBeenCalledWith(testInput, expect.objectContaining({
        workflow: expect.objectContaining({
          runId: 'workflow-run-1',
          workflowId: 'my-workflow',
        }),
        runtimeContext: expect.any(Object),
        suspend: expect.any(Function),
      }));
    });

    it('should provide same argument structure for legacy workflow step execution', async () => {
      const { tool, executeSpy } = createTestTool();

      // BREAKING CHANGE v1.0: Legacy workflows must now pass raw input as first arg
      const workflowContext = {
        runId: 'run-123',
        emit: vi.fn(),
        mastra: undefined,
        runtimeContext: {} as RuntimeContext,
        suspend: async () => {},
      };

      await tool.execute(testInput, workflowContext);

      // EXPECTED: Tool author should receive the input data as first param
      // and context as second param with workflow properties nested
      expect(executeSpy).toHaveBeenCalledWith(testInput, expect.objectContaining({
        workflow: expect.objectContaining({
          runId: 'run-123',
        }),
        runtimeContext: expect.any(Object),
        suspend: expect.any(Function),
      }));
    });

    it('should provide same argument structure for evented workflow execution', async () => {
      const { tool, executeSpy } = createTestTool();

      // BREAKING CHANGE v1.0: Evented workflows must now pass raw input as first arg
      const eventedContext = {
        runId: 'run-456',
        workflowId: 'workflow-1',
        mastra: undefined,
        runtimeContext: {} as RuntimeContext,
        state: {},
        setState: vi.fn(),
        retryCount: 0,
        suspend: async () => {},
        bail: vi.fn(),
        writer: undefined,
        abort: vi.fn(),
        tracingContext: {},
        abortSignal: new AbortController().signal,
      };

      // BREAKING CHANGE v1.0: Pass raw input as first arg, context as second
      await tool.execute(testInput, eventedContext);

      // EXPECTED: Tool author should receive the input data as first param
      // and context as second param with workflow properties nested
      expect(executeSpy).toHaveBeenCalledWith(testInput, expect.objectContaining({
        workflow: expect.objectContaining({
          runId: 'run-456',
          workflowId: 'workflow-1',
          state: expect.any(Object),
          setState: expect.any(Function),
        }),
        runtimeContext: expect.any(Object),
        suspend: expect.any(Function),
        abortSignal: expect.any(AbortSignal),
      }));
    });

    it('should provide same argument structure when called programmatically', async () => {
      const { tool, executeSpy } = createTestTool();

      // Direct programmatic call - how users might call tools directly
      await tool.execute(testInput as any);

      // EXPECTED: Tool author should receive the input data as first param
      // Context will be minimal when called directly
      expect(executeSpy).toHaveBeenCalledWith(testInput, expect.objectContaining({
        mastra: undefined,
      }));
    });

    it('should provide consistent access to execution metadata', async () => {
      // Tool that needs access to execution metadata
      const metadataAwareTool = new Tool({
        id: 'metadata-aware-tool',
        description: 'Tool that uses execution metadata',
        inputSchema: userSchema,
        outputSchema: z.object({
          hasRuntimeContext: z.boolean(),
          hasSuspend: z.boolean(),
          hasResumeData: z.boolean(),
          hasTracingContext: z.boolean(),
        }),
        execute: async (input: any, context?: any) => {
          // BREAKING CHANGE: Tools should receive two parameters:
          // 1. input: The actual tool input data (consistent structure)
          // 2. context: Execution metadata (runtime context, suspend, etc.)

          // This should work consistently across all execution contexts
          return {
            hasRuntimeContext: !!context?.runtimeContext,
            hasSuspend: typeof context?.suspend === 'function',
            hasResumeData: context?.resumeData !== undefined,
            hasTracingContext: !!context?.tracingContext,
          };
        },
      });

      // BREAKING CHANGE v1.0: Pass raw input as first arg, context as second
      const agentContext = {
        toolCallId: 'call-meta',
        messages: [],
        runtimeContext: {} as RuntimeContext,
        tracingContext: {},
        suspend: async () => {},
        resumeData: { someData: 'test' },
      };

      const result = await metadataAwareTool.execute(testInput, agentContext);

      // All metadata should be accessible consistently
      expect(result).toEqual({
        hasRuntimeContext: true,
        hasSuspend: true,
        hasResumeData: true,
        hasTracingContext: true,
      });
    });
  });

  describe('Complex scenarios with nested data', () => {
    it('should handle tools with complex nested schemas consistently', async () => {
      const complexSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            settings: z.object({
              theme: z.string(),
              notifications: z.boolean(),
            }),
          }),
        }),
        metadata: z.object({
          timestamp: z.number(),
          version: z.string(),
        }),
      });

      const complexInput = {
        user: {
          profile: {
            name: 'Bob',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
        },
      };

      const executeSpy = vi.fn(async (input: unknown, context?: any) => {
        // Tool authors should be able to access nested data directly
        const userName = (input as any).user.profile.name;
        const theme = (input as any).user.profile.settings.theme;
        return { userName, theme };
      });

      const complexTool = new Tool({
        id: 'complex-tool',
        description: 'Complex nested tool',
        inputSchema: complexSchema,
        outputSchema: z.object({
          userName: z.string(),
          theme: z.string(),
        }),
        execute: executeSpy,
      });

      // BREAKING CHANGE v1.0: Test all contexts with raw input as first argument
      const contexts = [
        // Agent context
        {
          toolCallId: 'call-456',
          messages: [],
          runtimeContext: {} as RuntimeContext,
        },
        // Workflow context
        {
          runId: 'run-123',
          workflowId: 'workflow-1',
          runtimeContext: {} as RuntimeContext,
        },
        // Direct call (undefined context)
        undefined,
      ];

      // BREAKING CHANGE v1.0: Always pass raw input as first argument
      for (const ctx of contexts) {
        executeSpy.mockClear();
        await complexTool.execute(complexInput, ctx);

        // Tool should always receive the same structure (input + context)
        expect(executeSpy).toHaveBeenCalledWith(complexInput, expect.any(Object));
      }
    });

    it('should handle optional and nullable fields consistently', async () => {
      const optionalSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        nullable: z.string().nullable().optional(),  // Make it optional too
        optionalNullable: z.string().optional().nullable(),
      });

      const inputs = [
        { required: 'test' },
        { required: 'test', optional: 'value' },
        { required: 'test', nullable: null },
        { required: 'test', optional: 'value', nullable: null, optionalNullable: null },
      ];

      const executeSpy = vi.fn(async (input: unknown, context?: any) => input);

      const tool = new Tool({
        id: 'optional-tool',
        description: 'Tool with optional fields',
        inputSchema: optionalSchema,
        execute: executeSpy,
      });

      // BREAKING CHANGE v1.0: Always pass raw input as first argument
      for (const input of inputs) {
        // Test in different contexts

        // Agent context
        executeSpy.mockClear();
        const agentContext = { toolCallId: 'call-1', messages: [], runtimeContext: {} as RuntimeContext };
        const result = await tool.execute(input, agentContext);
        if (result?.error) {
          console.log('Validation error:', result);
          throw new Error(`Validation failed: ${result.message}`);
        }
        expect(executeSpy).toHaveBeenCalledWith(input, expect.any(Object));

        // Workflow context
        executeSpy.mockClear();
        const workflowContext = { runId: '123', workflowId: 'wf-1', runtimeContext: {} as RuntimeContext };
        await tool.execute(input, workflowContext);
        expect(executeSpy).toHaveBeenCalledWith(input, expect.any(Object));

        // Direct call
        executeSpy.mockClear();
        await tool.execute(input);
        expect(executeSpy).toHaveBeenCalledWith(input, expect.any(Object));
      }
    });
  });

  describe('Backwards compatibility considerations', () => {
    it('should document migration path for existing tools', async () => {
      // OLD WAY: Tool receives wrapped context
      const oldTool = new Tool({
        id: 'old-tool',
        description: 'Legacy tool implementation',
        inputSchema: userSchema,
        execute: async (wrappedContext: any) => {
          // Old tools had to handle different wrapper formats
          let actualData;

          if (wrappedContext.context) {
            if (wrappedContext.context.inputData) {
              // Legacy workflow format
              actualData = wrappedContext.context.inputData;
            } else {
              // Agent/workflow format
              actualData = wrappedContext.context;
            }
          } else if (wrappedContext.inputData) {
            // Evented workflow format
            actualData = wrappedContext.inputData;
          } else {
            // Direct call
            actualData = wrappedContext;
          }

          return { name: actualData.name };
        },
      });

      // NEW WAY: Tool receives consistent structure
      const newTool = new Tool({
        id: 'new-tool',
        description: 'New tool implementation',
        inputSchema: userSchema,
        execute: async (input, context) => {
          // Simple, direct access to input data
          return { name: input.name };
        },
      });

      // Both should work, but new way is much simpler
      expect(newTool).toBeDefined();
      expect(oldTool).toBeDefined();
    });

    it('should provide clear error messages for migration', async () => {
      const tool = new Tool({
        id: 'migration-tool',
        description: 'Tool for testing migration errors',
        inputSchema: userSchema,
        execute: async (input: any) => {
          // After migration, this should work
          if (!input.name || typeof input.name !== 'string') {
            throw new Error(
              'Expected input.name to be a string. ' +
              'If you are seeing wrapped context objects, please update to the new tool argument structure. ' +
              'See migration guide at: https://docs.mastra.ai/v1-migration'
            );
          }
          return { name: input.name };
        },
      });

      // This should throw a helpful error if not migrated
      const wrongContext = {
        context: { name: 'Test' },
        runtimeContext: {},
      };

      // The tool returns a validation error rather than throwing
      const result = await tool.execute(wrongContext as any);
      expect(result.error).toBe(true);
      expect(result.message).toContain('validation failed');
    });
  });

  describe('Tool streaming and async operations', () => {
    it('should provide consistent streaming interface across contexts', async () => {
      const streamingTool = new Tool({
        id: 'streaming-tool',
        description: 'Tool that streams data',
        inputSchema: z.object({ message: z.string() }),
        execute: async (input, context) => {
          // Streaming should work consistently
          if (context?.writer) {
            await context.writer.write({ chunk: 'Starting...' });
            await context.writer.write({ chunk: input.message });
            await context.writer.write({ chunk: 'Done!' });
          }
          return { streamed: true };
        },
      });

      const writer = {
        write: vi.fn(async () => {}),
      };

      // BREAKING CHANGE v1.0: Always pass raw input as first argument
      const testMessage = { message: 'Hello' };
      const contexts = [
        // Agent with writer
        {
          toolCallId: 'stream-1',
          messages: [],
          runtimeContext: {} as RuntimeContext,
          writer,
        },
        // Workflow with writer
        {
          runId: 'stream-run',
          workflowId: 'stream-wf',
          runtimeContext: {} as RuntimeContext,
          writer,
        },
      ];

      for (const ctx of contexts) {
        writer.write.mockClear();
        await streamingTool.execute(testMessage, ctx);

        // Writer should be called consistently
        expect(writer.write).toHaveBeenCalledTimes(3);
        expect(writer.write).toHaveBeenCalledWith({ chunk: 'Starting...' });
        expect(writer.write).toHaveBeenCalledWith({ chunk: 'Hello' });
        expect(writer.write).toHaveBeenCalledWith({ chunk: 'Done!' });
      }
    });

    it('should provide consistent suspend/resume interface across contexts', async () => {
      const suspendableTool = new Tool({
        id: 'suspendable-tool',
        description: 'Tool that can suspend',
        inputSchema: z.object({ needsApproval: z.boolean() }),
        execute: async (input, context) => {
          if (input.needsApproval && context?.suspend) {
            const resumeData = await context.suspend({ reason: 'Needs approval' });
            return { approved: resumeData?.approved || false };
          }
          return { approved: true };
        },
      });

      const suspendSpy = vi.fn(async () => ({ approved: true }));

      // BREAKING CHANGE v1.0: Pass raw input as first argument
      const testInput = { needsApproval: true };
      const contexts = [
        // Agent context
        {
          toolCallId: 'suspend-1',
          messages: [],
          runtimeContext: {} as RuntimeContext,
          suspend: suspendSpy,
        },
        // Workflow context
        {
          runId: 'suspend-run',
          workflowId: 'suspend-wf',
          runtimeContext: {} as RuntimeContext,
          suspend: suspendSpy,
        },
      ];

      for (const ctx of contexts) {
        suspendSpy.mockClear();
        const result = await suspendableTool.execute(testInput, ctx);

        expect(suspendSpy).toHaveBeenCalledWith({ reason: 'Needs approval' });
        expect(result).toEqual({ approved: true });
      }
    });
  });
});