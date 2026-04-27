/**
 * Tool workflow execution tests for DurableAgent
 *
 * End-to-end tests that verify actual workflow execution for:
 * - Tool approval (suspension and resume)
 * - In-execution tool suspension (tool calls suspend())
 * - Foreach pattern (single and multiple tool calls)
 * - Tool error handling in foreach pattern
 *
 * These tests exercise the full workflow lifecycle including stream(),
 * suspend, and resume() across all engines (core, evented, inngest).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createToolCallModel, createToolCallThenTextModel, createMultiToolCallThenTextModel } from '../mock-models';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createToolWorkflowExecutionTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;
  // Use a longer delay for workflow execution tests (need time for workflow to process)
  // Inngest round-trips require significantly more time than local engines
  const executionDelay = Math.max(eventPropagationDelay * 2, 500);

  describe('tool workflow execution', () => {
    describe('tool approval suspension', () => {
      it('should suspend workflow when tool requires approval', async () => {
        const mockModel = createToolCallModel('searchTool', { query: 'test' });

        const searchTool = createTool({
          id: 'searchTool',
          description: 'Search for information',
          inputSchema: z.object({ query: z.string() }),
          requireApproval: true,
          execute: async () => ({ results: ['result1', 'result2'] }),
        });

        const agent = await createAgent({
          id: 'approval-exec-agent',
          instructions: 'You can search for information',
          model: mockModel,
          tools: { searchTool },
        });

        let suspendedData: any = null;
        const { cleanup } = await agent.stream('Search for test', {
          requireToolApproval: true,
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);

        expect(suspendedData).not.toBeNull();
        expect(suspendedData.type).toBe('approval');
        expect(suspendedData.toolName).toBe('searchTool');
        expect(suspendedData.toolCallId).toBe('call-1');

        cleanup();
      });

      it('should resume and complete after tool approval', async () => {
        const mockModel = createToolCallThenTextModel('searchTool', { query: 'test' }, 'Search complete');

        const searchTool = createTool({
          id: 'searchTool',
          description: 'Search for information',
          inputSchema: z.object({ query: z.string() }),
          requireApproval: true,
          execute: async () => ({ results: ['result1', 'result2'] }),
        });

        const agent = await createAgent({
          id: 'resume-approval-exec-agent',
          instructions: 'You can search for information',
          model: mockModel,
          tools: { searchTool },
          needsStorage: true,
        });

        let suspendedData: any = null;
        const { runId, cleanup } = await agent.stream('Search for test', {
          requireToolApproval: true,
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);
        expect(suspendedData).not.toBeNull();

        // Resume with approval
        let finishData: any = null;
        const resumeResult = await agent.resume!(
          runId,
          { approved: true },
          {
            onFinish: (data: any) => {
              finishData = data;
            },
          },
        );

        await delay(executionDelay * 2);

        expect(finishData).not.toBeNull();
        resumeResult.cleanup();
        cleanup();
      });

      it('should complete with denial result when tool approval is denied', async () => {
        const mockModel = createToolCallThenTextModel('searchTool', { query: 'test' }, 'Done');

        const searchTool = createTool({
          id: 'searchTool',
          description: 'Search for information',
          inputSchema: z.object({ query: z.string() }),
          requireApproval: true,
          execute: async () => ({ results: ['result1', 'result2'] }),
        });

        const agent = await createAgent({
          id: 'deny-approval-exec-agent',
          instructions: 'You can search for information',
          model: mockModel,
          tools: { searchTool },
          needsStorage: true,
        });

        let suspendedData: any = null;
        const { runId, cleanup } = await agent.stream('Search for test', {
          requireToolApproval: true,
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);
        expect(suspendedData).not.toBeNull();

        // Resume with denial
        let finishData: any = null;
        const resumeResult = await agent.resume!(
          runId,
          { approved: false },
          {
            onFinish: (data: any) => {
              finishData = data;
            },
          },
        );

        await delay(executionDelay * 2);

        expect(finishData).not.toBeNull();
        resumeResult.cleanup();
        cleanup();
      });
    });

    describe('in-execution tool suspension', () => {
      it('should suspend workflow when tool calls suspend()', async () => {
        const mockModel = createToolCallModel('suspendingTool', { data: 'test' });

        const suspendingTool = createTool({
          id: 'suspendingTool',
          description: 'A tool that suspends',
          inputSchema: z.object({ data: z.string() }),
          execute: async (_inputData: { data: string }, context?: any) => {
            const suspend = context?.agent?.suspend || context?.suspend;
            if (suspend) {
              await suspend({ reason: 'Need more info' });
            }
            return { done: true };
          },
        });

        const agent = await createAgent({
          id: 'in-exec-suspend-agent',
          instructions: 'Use the tool',
          model: mockModel,
          tools: { suspendingTool },
        });

        let suspendedData: any = null;
        const { cleanup } = await agent.stream('Use the tool', {
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);

        expect(suspendedData).not.toBeNull();
        expect(suspendedData.type).toBe('suspension');

        cleanup();
      });

      it('should resume and complete after in-execution suspension', async () => {
        const mockModel = createToolCallThenTextModel('suspendingTool', { data: 'test' }, 'Resumed!');

        const suspendingTool = createTool({
          id: 'suspendingTool',
          description: 'A tool that suspends on first call',
          inputSchema: z.object({ data: z.string() }),
          execute: async (_inputData: { data: string }, context?: any) => {
            const suspend = context?.agent?.suspend || context?.suspend;
            const resumeData = context?.agent?.resumeData || context?.resumeData;
            if (suspend && !resumeData) {
              await suspend({ reason: 'Need confirmation' });
            }
            return { result: 'processed', extra: resumeData };
          },
        });

        const agent = await createAgent({
          id: 'resume-in-exec-agent',
          instructions: 'Use the tool',
          model: mockModel,
          tools: { suspendingTool },
          needsStorage: true,
        });

        let suspendedData: any = null;
        const { runId, cleanup } = await agent.stream('Use the tool', {
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);
        expect(suspendedData).not.toBeNull();

        // Resume with data
        let finishData: any = null;
        const resumeResult = await agent.resume!(
          runId,
          { confirmed: true },
          {
            onFinish: (data: any) => {
              finishData = data;
            },
          },
        );

        await delay(executionDelay * 2);

        expect(finishData).not.toBeNull();
        resumeResult.cleanup();
        cleanup();
      });
    });

    describe('foreach tool execution pattern', () => {
      it('should execute a single tool call and complete', async () => {
        const mockModel = createToolCallThenTextModel('echoTool', { message: 'hello' }, 'Echo complete');

        const echoTool = createTool({
          id: 'echoTool',
          description: 'Echo the input',
          inputSchema: z.object({ message: z.string() }),
          execute: async ({ message }) => `Echo: ${message}`,
        });

        const agent = await createAgent({
          id: 'single-foreach-agent',
          instructions: 'Echo messages',
          model: mockModel,
          tools: { echoTool },
        });

        let finishData: any = null;
        const toolResults: any[] = [];

        const { cleanup } = await agent.stream('Echo hello', {
          onChunk: (chunk: any) => {
            if (chunk.type === 'tool-result') {
              toolResults.push(chunk);
            }
          },
          onFinish: (data: any) => {
            finishData = data;
          },
        });

        // Full agentic loop: LLM → tool → LLM → finish needs extra time
        await delay(executionDelay * 2);

        expect(finishData).not.toBeNull();
        expect(toolResults.length).toBeGreaterThan(0);

        cleanup();
      });

      it('should execute multiple tool calls and complete', async () => {
        const mockModel = createMultiToolCallThenTextModel(
          [
            { toolName: 'addTool', args: { a: 2, b: 3 } },
            { toolName: 'multiplyTool', args: { a: 4, b: 5 } },
          ],
          'Calculations done',
        );

        const addTool = createTool({
          id: 'addTool',
          description: 'Add two numbers',
          inputSchema: z.object({ a: z.number(), b: z.number() }),
          execute: async ({ a, b }) => a + b,
        });

        const multiplyTool = createTool({
          id: 'multiplyTool',
          description: 'Multiply two numbers',
          inputSchema: z.object({ a: z.number(), b: z.number() }),
          execute: async ({ a, b }) => a * b,
        });

        const agent = await createAgent({
          id: 'multi-foreach-agent',
          instructions: 'Calculate',
          model: mockModel,
          tools: { addTool, multiplyTool },
        });

        let finishData: any = null;
        const toolResults: any[] = [];

        const { cleanup } = await agent.stream('Add 2+3 and multiply 4*5', {
          onChunk: (chunk: any) => {
            if (chunk.type === 'tool-result') {
              toolResults.push(chunk);
            }
          },
          onFinish: (data: any) => {
            finishData = data;
          },
        });

        // Full agentic loop: LLM → tools → LLM → finish needs extra time
        await delay(executionDelay * 2);

        expect(finishData).not.toBeNull();
        expect(toolResults.length).toBe(2);

        cleanup();
      });

      it('should handle tool errors gracefully', async () => {
        const mockModel = createToolCallThenTextModel('errorTool', { input: 'test' }, 'Handled error');

        const errorTool = createTool({
          id: 'errorTool',
          description: 'A tool that throws',
          inputSchema: z.object({ input: z.string() }),
          execute: async () => {
            throw new Error('Tool execution failed');
          },
        });

        const agent = await createAgent({
          id: 'error-foreach-agent',
          instructions: 'Use the tool',
          model: mockModel,
          tools: { errorTool },
        });

        const toolErrors: any[] = [];

        const { cleanup } = await agent.stream('Use the error tool', {
          onChunk: (chunk: any) => {
            if (chunk.type === 'tool-error') {
              toolErrors.push(chunk);
            }
          },
        });

        await delay(executionDelay);

        // The tool error should be captured
        expect(toolErrors.length).toBeGreaterThan(0);

        cleanup();
      });
    });
  });
}
