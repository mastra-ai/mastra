import { randomUUID } from 'node:crypto';
import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor, ProcessOutputResultArgs } from '../../processors/index';
import { RequestContext, MASTRA_THREAD_ID_KEY, MASTRA_RESOURCE_ID_KEY } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MessageFilterContext, DelegationCompleteContext, IterationCompleteContext } from '../agent.types';
import type { MastraDBMessage } from '../message-list/state/types';

// Helper: create a sub-agent with a fixed text response
function makeSubAgent(id: string, responseText: string) {
  return new Agent({
    id,
    name: id,
    description: `Sub-agent: ${id}`,
    instructions: 'You are a helpful sub-agent.',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        text: responseText,
        content: [{ type: 'text', text: responseText }],
        warnings: [],
      }),
    }),
  });
}

// Helper: create a sub-agent mock model that calls a specific tool then stops
function makeSubAgentModelWithTool(toolName: string, toolArgs: Record<string, any>) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'sub-call-1',
              toolName,
              input: JSON.stringify(toolArgs),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        text: 'Task completed.',
        content: [{ type: 'text' as const, text: 'Task completed.' }],
        warnings: [],
      };
    },
  });
}

// Helper: create a supervisor model that delegates to a sub-agent tool then stops
function makeSupervisorModel(agentKey: string, prompt: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: `agent-${agentKey}`,
              input: JSON.stringify({ prompt }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text', text: 'Done' }],
        warnings: [],
      };
    },
  });
}

/**
 * Integration tests for the supervisor pattern with delegation hooks.
 * Tests the complete flow of delegation hooks, iteration hooks, and bail mechanism.
 */
describe('Supervisor Pattern Integration Tests', () => {
  describe('Delegation hooks with regular tools', () => {
    it('should NOT trigger delegation hooks when a regular tool is called', async () => {
      const onDelegationStart = vi.fn(() => ({ proceed: true }));
      const onDelegationComplete = vi.fn(() => undefined);

      const regularTool = createTool({
        id: 'regular-tool',
        description: 'A regular tool (not a sub-agent)',
        inputSchema: z.object({
          task: z.string(),
        }),
        execute: async ({ task }) => {
          return { result: `Processed: ${task}` };
        },
      });

      // Create model that calls the regular tool once then stops
      let callCount = 0;
      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You delegate to tools',
        model: new MockLanguageModelV2({
          doGenerate: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: '',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'regular-tool',
                    args: { task: 'data-analysis' },
                  },
                ],
                warnings: [],
              };
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'Done',
              content: [{ type: 'text', text: 'Done' }],
              warnings: [],
            };
          },
        }),
        tools: { regularTool },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Delegate task', {
        maxSteps: 3,
        delegation: {
          onDelegationStart,
          onDelegationComplete,
        },
      });

      // Delegation hooks only fire for sub-agent/workflow tools, NOT regular tools
      expect(onDelegationStart).not.toHaveBeenCalled();
      expect(onDelegationComplete).not.toHaveBeenCalled();
    });

    it('should track iteration progress with onIterationComplete hook', async () => {
      const iterations: number[] = [];

      const simpleTool = createTool({
        id: 'simple-tool',
        description: 'A simple tool',
        inputSchema: z.object({
          input: z.string(),
        }),
        execute: async () => {
          return { result: 'done' };
        },
      });

      // Create model that generates tool call then stops
      let callCount = 0;
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You use tools',
        model: new MockLanguageModelV2({
          doGenerate: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                text: '',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'simple-tool',
                    args: { input: 'test' },
                  },
                ],
                warnings: [],
              };
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'Final response',
              content: [{ type: 'text', text: 'Final response' }],
              warnings: [],
            };
          },
        }),
        tools: {
          simpleTool,
        },
        memory: new MockMemory(),
      });

      await agent.generate('Use tool then respond', {
        maxSteps: 3,
        onIterationComplete: (ctx: IterationCompleteContext) => {
          iterations.push(ctx.iteration);
        },
      });

      // Two iterations: one for the tool call, one for the final stop response
      expect(iterations).toEqual([1, 2]);
    });
  });

  describe('Delegation hooks with sub-agent tools', () => {
    it('should trigger onDelegationStart when delegating to a sub-agent', async () => {
      const onDelegationStart = vi.fn(() => ({ proceed: true }));
      const subAgent = makeSubAgent('research-agent', 'Dolphins are marine mammals.');

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('researchAgent', 'research dolphins'),
        agents: { researchAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Research dolphins', {
        maxSteps: 3,
        delegation: { onDelegationStart },
      });

      expect(onDelegationStart).toHaveBeenCalledTimes(1);
      expect(onDelegationStart).toHaveBeenCalledWith(
        expect.objectContaining({
          primitiveType: 'agent',
          prompt: 'research dolphins',
        }),
      );
    });

    it('should trigger onDelegationComplete with the sub-agent result', async () => {
      const onDelegationComplete = vi.fn(() => undefined);
      const subAgent = makeSubAgent('writer-agent', 'Here is the final report.');

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('writerAgent', 'write a report'),
        agents: { writerAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Write a report', {
        maxSteps: 3,
        delegation: { onDelegationComplete },
      });

      expect(onDelegationComplete).toHaveBeenCalledTimes(1);
      expect(onDelegationComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          primitiveType: 'agent',
          result: expect.objectContaining({ text: 'Here is the final report.' }),
        }),
      );
    });

    it('should skip sub-agent when onDelegationStart returns proceed: false', async () => {
      const subAgentGenerate = vi.fn();
      const subAgent = makeSubAgent('blocked-agent', 'Should not be called');
      // Spy on the sub-agent's generate to detect if it was invoked
      subAgent.generate = subAgentGenerate;

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('blockedAgent', 'do something'),
        agents: { blockedAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Do something', {
        maxSteps: 3,
        delegation: {
          onDelegationStart: () => ({ proceed: false }),
        },
      });

      // Sub-agent's generate should never have been called
      expect(subAgentGenerate).not.toHaveBeenCalled();
    });

    it('should allow onDelegationStart to modify the prompt sent to the sub-agent', async () => {
      const receivedPrompts: string[] = [];

      const subAgentModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          // Capture all user message contents to verify the modified prompt
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          for (const msg of messages) {
            if ((msg as any).role === 'user') {
              const content = Array.isArray((msg as any).content)
                ? (msg as any).content.find((c: any) => c.type === 'text')?.text
                : (msg as any).content;
              if (content) receivedPrompts.push(content);
            }
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: 'Done',
            content: [{ type: 'text', text: 'Done' }],
            warnings: [],
          };
        },
      });

      const subAgent = new Agent({
        id: 'prompt-agent',
        name: 'prompt-agent',
        description: 'Test sub-agent',
        instructions: 'You are a helper.',
        model: subAgentModel,
      });

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('promptAgent', 'original prompt'),
        agents: { promptAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Do something', {
        maxSteps: 3,
        delegation: {
          onDelegationStart: () => ({ proceed: true, modifiedPrompt: 'MODIFIED PROMPT' }),
        },
      });

      // The sub-agent's user message should contain the modified prompt
      expect(receivedPrompts.some(p => p.includes('MODIFIED PROMPT'))).toBe(true);
      expect(receivedPrompts.some(p => p.includes('original prompt'))).toBe(false);
    });

    it('should invoke messageFilter callback before delegating to a sub-agent', async () => {
      const messageFilterSpy = vi.fn(({ messages }: MessageFilterContext) => messages.filter(m => m.role !== 'system'));

      const subAgent = makeSubAgent('filter-agent', 'Filtered context response');

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('filterAgent', 'task with context'),
        agents: { filterAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Task with context', {
        maxSteps: 3,
        delegation: { messageFilter: messageFilterSpy },
      });

      // messageFilter should be called once for the single sub-agent delegation
      expect(messageFilterSpy).toHaveBeenCalledTimes(1);
      expect(messageFilterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          primitiveType: 'agent',
          prompt: 'task with context',
          parentAgentId: 'supervisor',
        }),
      );
    });

    it('should call both onDelegationStart and onDelegationComplete in order', async () => {
      const callOrder: string[] = [];

      const subAgent = makeSubAgent('ordered-agent', 'Order test response');

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: makeSupervisorModel('orderedAgent', 'ordered task'),
        agents: { orderedAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Ordered task', {
        maxSteps: 3,
        delegation: {
          onDelegationStart: () => {
            callOrder.push('start');
            return { proceed: true };
          },
          onDelegationComplete: () => {
            callOrder.push('complete');
          },
        },
      });

      expect(callOrder).toEqual(['start', 'complete']);
    });

    it('should stop execution when bail() is called in onDelegationComplete', async () => {
      const subAgent = makeSubAgent('bail-agent', 'Critical result');
      let iterationsAfterBail = 0;

      // Model that would call the sub-agent twice if not bailed
      let callCount = 0;
      const supervisorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount <= 2) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${callCount}`,
                  toolName: 'agent-bailAgent',
                  input: JSON.stringify({ prompt: `task ${callCount}` }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Done',
            content: [{ type: 'text', text: 'Done' }],
            warnings: [],
          };
        },
      });

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { bailAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Two-task job', {
        maxSteps: 10,
        onIterationComplete: () => {
          iterationsAfterBail++;
          return { continue: true };
        },
        delegation: {
          onDelegationComplete: (ctx: DelegationCompleteContext) => {
            ctx.bail();
          },
        },
      });

      // Bail after first delegation — only 1 iteration fires (the tool-call one)
      expect(iterationsAfterBail).toBe(1);
    });
  });

  describe('Hook configuration validation', () => {
    it('should accept all delegation hook options', async () => {
      const delegationConfig = {
        onDelegationStart: vi.fn(() => {
          return { proceed: true };
        }),
        onDelegationComplete: vi.fn(() => {
          return undefined;
        }),
        messageFilter: ({ messages }: MessageFilterContext) => messages.filter(m => m.role !== 'system').slice(-10),
      };

      const agent = new Agent({
        id: 'configured-agent',
        name: 'Configured Agent',
        instructions: 'Test agent',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Response',
            content: [{ type: 'text', text: 'Response' }],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        }),
        memory: new MockMemory(),
      });

      // Verify delegation config is accepted without errors
      await agent.generate('Test prompt', {
        maxSteps: 1,
        delegation: delegationConfig,
      });

      // Hooks won't be called without agent/workflow tools, but config is valid
      expect(delegationConfig.onDelegationStart).not.toHaveBeenCalled();
      expect(delegationConfig.onDelegationComplete).not.toHaveBeenCalled();
    });

    it('should accept iteration complete hook configuration', async () => {
      const iterationHook = vi.fn(() => {
        return undefined;
      });

      const agent = new Agent({
        id: 'iteration-agent',
        name: 'Iteration Agent',
        instructions: 'Test agent',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Response',
            content: [{ type: 'text', text: 'Response' }],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        }),
        memory: new MockMemory(),
      });

      await agent.generate('Test prompt', {
        maxSteps: 1,
        onIterationComplete: iterationHook,
      });

      // Hook should be called once for the iteration that completed with 'stop'
      expect(iterationHook).toHaveBeenCalledTimes(1);
      const hookCall = iterationHook.mock.calls[0]?.[0];
      expect(hookCall).toMatchObject({
        iteration: 1,
        text: 'Response',
        isFinal: true,
        finishReason: 'stop',
        agentId: 'iteration-agent',
        toolCalls: [],
        toolResults: [],
      });
      expect(hookCall.messages).toBeDefined();
      expect(hookCall.messages.length).toBe(2); // user message + assistant response
    });
  });
});

/**
 * Working memory forwarding in supervisor pattern.
 * Replicates the agent-network updateWorkingMemory test for the supervisor generate() pattern.
 * Uses a real OpenAI model to verify memory context is forwarded to sub-agents.
 */
describe('Supervisor Pattern - Working memory forwarding', () => {
  it.skipIf(!process.env.OPENAI_API_KEY)(
    'should forward memory context to sub-agents without updateWorkingMemory errors',
    async () => {
      // Create a shared memory instance with working memory enabled
      // This is the scenario from issue #9873 where sub-agents share the same memory template
      const sharedMemory = new MockMemory({
        enableWorkingMemory: true,
        workingMemoryTemplate: `
      # Information Profile
      - Title:
      - Some facts:
        - Fact 1:
        - Fact 2:
        - Fact 3:
      - Summary:
      `,
      });

      // Create sub-agents with the shared memory and working memory enabled
      // These agents will need threadId/resourceId to use updateWorkingMemory tool
      const subAgent1 = new Agent({
        id: 'sub-agent-1',
        name: 'Sub Agent 1',
        instructions:
          'You are a helpful research assistant. When the user provides information, remember it using your memory tools.',
        model: openai('gpt-4o-mini'),
        defaultOptions: {
          toolChoice: 'required',
        },
      });

      // Create network agent with the same shared memory
      const supervisorWithSharedMemory = new Agent({
        id: 'supervisor-with-shared-memory',
        name: 'Supervisor With Shared Memory',
        instructions: 'You can delegate tasks to sub-agents. Sub Agent 1 handles research tasks.',
        model: openai('gpt-4o-mini'),
        agents: {
          subAgent1,
        },
        memory: sharedMemory,
      });

      const threadId = 'test-thread-shared-memory';
      const resourceId = 'test-resource-shared-memory';

      // Consume the stream and check for updateWorkingMemory errors
      const agentStream = await supervisorWithSharedMemory.stream('Research dolphins and write a summary', {
        memory: { thread: threadId, resource: resourceId },
      });

      let subAgentWorkingMemorySuccessful = false;
      for await (const chunk of agentStream.fullStream) {
        if (chunk.type === 'tool-output') {
          const payload = chunk.payload;
          if (payload.toolName?.startsWith('agent-')) {
            const output = payload.output;
            if (output && output.type === 'tool-result' && output.payload.toolName === 'updateWorkingMemory') {
              if (output.payload.result?.success) {
                subAgentWorkingMemorySuccessful = true;
              } else if (output.payload.isError) {
                subAgentWorkingMemorySuccessful = false;
              }
            }
          }
        }
      }

      expect(subAgentWorkingMemorySuccessful).toBe(true);

      // Verify that the parent thread was created in memory (confirms memory ops worked)
      const thread = await sharedMemory.getThreadById({ threadId });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe(threadId);
      expect(thread?.resourceId).toBe(resourceId);
      const workingMemory = await sharedMemory.getWorkingMemory({ threadId, resourceId });
      expect(workingMemory).toBeDefined();

      const subAgentMemory = await subAgent1.getMemory();
      expect(subAgentMemory).toBeDefined();
      const subAgentThreads = await subAgentMemory?.listThreads({});
      const firstThread = subAgentThreads?.threads[0];
      expect(firstThread).toBeDefined();
      if (firstThread) {
        const subAgentWorkingMemory = await subAgentMemory?.getWorkingMemory({
          threadId: firstThread.id,
          resourceId: `${resourceId}-subAgent1`,
        });
        expect(subAgentWorkingMemory).toBeDefined();
      } else {
        expect.fail('No thread found for sub-agent');
      }
    },
    120e6,
  );
});

/**
 * Tool approval in supervisor pattern.
 * Tests that when a sub-agent has a tool with requireApproval: true,
 * the approval request propagates through the supervisor's stream.
 */
describe('Supervisor Pattern - Tool approval propagation', () => {
  const mockStorage = new InMemoryStore();

  afterEach(async () => {
    const workflowsStore = await mockStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  it('should propagate tool approval from sub-agent through supervisor stream', async () => {
    const mockFindUser = vi.fn().mockResolvedValue({ name: 'Alice', email: 'alice@example.com' });

    const findUserTool = createTool({
      id: 'find-user-tool',
      description: 'Find user information by name.',
      inputSchema: z.object({ name: z.string().describe('User name to look up') }),
      requireApproval: true,
      execute: async (input: { name: string }) => mockFindUser(input),
    });

    // Sub-agent mock: calls findUserTool on first invocation using doStream
    let subCallCount = 0;
    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => {
        subCallCount++;
        if (subCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'sub-call-1',
                toolName: 'find-user-tool',
                input: '{"name":"Alice"}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Found Alice successfully.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const subAgent = new Agent({
      id: 'approval-sub-agent',
      name: 'Approval Sub Agent',
      description: 'An agent that looks up user info.',
      instructions: 'You look up user info using the find-user-tool.',
      model: subAgentModel,
      tools: { findUserTool },
    });

    // Supervisor mock: calls agent-approvalSubAgent using doStream
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'supervisor-call-1',
                toolName: 'agent-approvalSubAgent',
                input: JSON.stringify({ prompt: 'find Alice' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const supervisorAgent = new Agent({
      id: 'approval-supervisor',
      name: 'Approval Supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: supervisorModel,
      agents: { approvalSubAgent: subAgent },
      memory: new MockMemory(),
    });

    new Mastra({
      agents: { approvalSupervisor: supervisorAgent },
      storage: mockStorage,
    });

    const stream = await supervisorAgent.stream('Find Alice', { maxSteps: 5 });

    let approvalChunkReceived = false;
    let approvalToolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        approvalChunkReceived = true;
        approvalToolCallId = chunk.payload?.toolCallId;
      }
    }

    // Tool approval should have been requested before tool execution
    expect(approvalChunkReceived).toBe(true);
    expect(approvalToolCallId).toBeTruthy();

    // Approve the tool call and verify execution continues
    const resumeStream = await supervisorAgent.approveToolCall({
      runId: stream.runId,
      toolCallId: approvalToolCallId,
    });

    for await (const _chunk of resumeStream.fullStream) {
      // consume
    }

    // Tool should now have been executed after approval
    expect(mockFindUser).toHaveBeenCalled();
  });

  it('should propagate tool approval decline from sub-agent through supervisor stream', async () => {
    const mockFindUser = vi.fn().mockResolvedValue({ name: 'Bob', email: 'bob@example.com' });

    const findUserTool = createTool({
      id: 'find-user-tool-decline',
      description: 'Find user information by name.',
      inputSchema: z.object({ name: z.string().describe('User name to look up') }),
      requireApproval: true,
      execute: async (input: { name: string }) => mockFindUser(input),
    });

    // Sub-agent mock: calls findUserTool on first invocation using doStream
    let subCallCount = 0;
    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => {
        subCallCount++;
        if (subCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'sub-call-decline-1',
                toolName: 'find-user-tool-decline',
                input: '{"name":"Bob"}',
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Could not find Bob - request was declined.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const subAgent = new Agent({
      id: 'approval-decline-sub-agent',
      name: 'Approval Decline Sub Agent',
      description: 'An agent that looks up user info.',
      instructions: 'You look up user info using the find-user-tool-decline.',
      model: subAgentModel,
      tools: { findUserTool },
    });

    // Supervisor mock: calls agent-approvalDeclineSubAgent using doStream
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'supervisor-call-decline-1',
                toolName: 'agent-approvalDeclineSubAgent',
                input: JSON.stringify({ prompt: 'find Bob' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Request declined' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const supervisorAgent = new Agent({
      id: 'approval-decline-supervisor',
      name: 'Approval Decline Supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: supervisorModel,
      agents: { approvalDeclineSubAgent: subAgent },
      memory: new MockMemory(),
    });

    new Mastra({
      agents: { approvalDeclineSupervisor: supervisorAgent },
      storage: mockStorage,
    });

    const stream = await supervisorAgent.stream('Find Bob', { maxSteps: 5 });

    let approvalChunkReceived = false;
    let approvalToolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        approvalChunkReceived = true;
        approvalToolCallId = chunk.payload?.toolCallId;
      }
    }

    // Tool approval should have been requested before tool execution
    expect(approvalChunkReceived).toBe(true);
    expect(approvalToolCallId).toBeTruthy();

    // Decline the tool call and verify tool is not executed
    const resumeStream = await supervisorAgent.declineToolCall({
      runId: stream.runId,
      toolCallId: approvalToolCallId,
    });

    let toolDeclinedMessage = '';

    for await (const _chunk of resumeStream.fullStream) {
      // consume
      if (_chunk.type === 'tool-output') {
        const output = _chunk.payload.output;
        if (output.type === 'tool-result' && output.payload.toolName === 'find-user-tool-decline') {
          toolDeclinedMessage = output.payload.result;
        }
      }
    }

    const toolResults = await resumeStream.toolResults;

    // Verify tool was NOT executed
    expect(mockFindUser).not.toHaveBeenCalled();

    // Verify we got tool results from the sub-agent delegation
    expect(toolResults.length).toBeGreaterThan(0);

    // The supervisor's tool result for the agent delegation should contain the sub-agent's response
    const subAgentResult = toolResults.find(tr => tr.payload?.toolName === 'agent-approvalDeclineSubAgent');
    expect(subAgentResult).toBeDefined();
    expect(subAgentResult?.payload?.result).toBeDefined();
    expect(toolDeclinedMessage).toBe('Tool call was not approved by the user');
  });
});

/**
 * Working memory persistence across multiple delegations.
 * Tests that when a supervisor delegates to the same sub-agent multiple times,
 * the sub-agent can access resource-scoped working memory saved in a previous delegation.
 */
describe('Supervisor Pattern - Working memory across delegations', () => {
  it('should persist resource-scoped working memory across multiple delegations to the same sub-agent', async () => {
    const sharedStore = new InMemoryStore();
    const sharedMemory = new MockMemory({
      storage: sharedStore,
      enableWorkingMemory: true,
    });

    // Track sub-agent thread/resource IDs from each delegation
    const delegationIds: { subAgentThreadId?: string; subAgentResourceId?: string }[] = [];

    // Sub-agent model:
    // Delegation 1, call 1: call updateWorkingMemory to save entity data
    // Delegation 1, call 2: respond with text
    // Delegation 2, call 1: respond with text
    let subCallCount = 0;
    let secondDelegationSawPersistedMemory = false;

    const subAgentModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subCallCount++;

        if (subCallCount === 1) {
          // First delegation, first call: save entity data to working memory
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'wm-call-1',
                toolName: 'updateWorkingMemory',
                input: JSON.stringify({
                  memory: '# Entity Data\n- **entityId**: 401881\n- **name**: Record X',
                }),
              },
            ],
            warnings: [],
          };
        }

        // Delegation 2 should include previously saved working-memory content in context
        if (subCallCount >= 3) {
          secondDelegationSawPersistedMemory = JSON.stringify(prompt).includes('401881');
        }

        // All subsequent calls: respond with text
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: subCallCount === 2 ? 'Found entity 401881' : 'Updated entity',
          content: [
            {
              type: 'text' as const,
              text: subCallCount === 2 ? 'Found entity 401881' : 'Updated entity',
            },
          ],
          warnings: [],
        };
      },
    });

    const subAgent = new Agent({
      id: 'worker-agent',
      name: 'worker-agent',
      description: 'A worker agent that handles entity operations',
      instructions: 'You handle entity operations. Use working memory to remember entity data.',
      model: subAgentModel,
    });

    // Supervisor model: always delegates to worker-agent, alternating between tool-call and stop
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doGenerate: async () => {
        supervisorCallCount++;
        if (supervisorCallCount % 2 === 1) {
          // Odd calls: delegate to sub-agent
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${supervisorCallCount}`,
                toolName: 'agent-workerAgent',
                input: JSON.stringify({
                  prompt: supervisorCallCount === 1 ? 'Find record X' : 'Update the entity',
                }),
              },
            ],
            warnings: [],
          };
        }
        // Even calls: final response
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Done',
          content: [{ type: 'text' as const, text: 'Done' }],
          warnings: [],
        };
      },
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You orchestrate sub-agents for entity operations.',
      model: supervisorModel,
      agents: { workerAgent: subAgent },
      memory: sharedMemory,
    });

    const threadId = 'supervisor-thread';
    const resourceId = 'test-user';

    // First generate call: supervisor delegates to sub-agent, sub-agent saves working memory
    await supervisor.generate('Find record X', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
      delegation: {
        onDelegationComplete: ctx => {
          delegationIds.push({
            subAgentThreadId: ctx.result?.subAgentThreadId,
            subAgentResourceId: ctx.result?.subAgentResourceId,
          });
        },
      },
    });

    // Verify first delegation completed and working memory was saved
    expect(delegationIds).toHaveLength(1);
    const firstDelegationResourceId = delegationIds[0]!.subAgentResourceId;
    expect(firstDelegationResourceId).toBeDefined();

    // Verify working memory was persisted under the sub-agent's resource ID
    const savedWorkingMemory = await sharedMemory.getWorkingMemory({
      threadId: delegationIds[0]!.subAgentThreadId!,
      resourceId: firstDelegationResourceId,
    });
    expect(savedWorkingMemory).toContain('401881');

    // Second generate call: supervisor delegates to same sub-agent again
    await supervisor.generate('Now update the entity', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
      delegation: {
        onDelegationComplete: ctx => {
          delegationIds.push({
            subAgentThreadId: ctx.result?.subAgentThreadId,
            subAgentResourceId: ctx.result?.subAgentResourceId,
          });
        },
      },
    });

    expect(delegationIds).toHaveLength(2);
    const secondDelegationResourceId = delegationIds[1]!.subAgentResourceId;

    // The sub-agent resource ID is deterministic (parentResourceId-agentName)
    // so it stays stable across delegations, allowing resource-scoped working memory to persist
    expect(secondDelegationResourceId).toBe(firstDelegationResourceId);

    // Working memory saved during delegation 1 should be retrievable using delegation 2's IDs
    const retrievedWorkingMemory = await sharedMemory.getWorkingMemory({
      threadId: delegationIds[1]!.subAgentThreadId!,
      resourceId: secondDelegationResourceId,
    });
    expect(retrievedWorkingMemory).toContain('401881');
    expect(secondDelegationSawPersistedMemory).toBe(true);
  });
});

/**
 * Suspension in supervisor pattern.
 * Tests that when a sub-agent calls suspend(), the suspension propagates
 * through the supervisor's generate() and can be resumed.
 */
describe('Supervisor Pattern - Suspension propagation', () => {
  const mockStorage = new InMemoryStore();

  afterEach(async () => {
    const workflowsStore = await mockStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  it('should propagate sub-agent tool suspension through supervisor generate() and allow resume', async () => {
    const suspendingTool = createTool({
      id: 'info-gatherer-tool',
      description: 'Gathers information but needs user input.',
      inputSchema: z.object({ query: z.string().describe('The information query') }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ extraInfo: z.string() }),
      execute: async (input: { query: string }, context: any) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ message: `Need more info for: ${input.query}` });
        }
        return { answer: `${input.query}: ${context.agent.resumeData.extraInfo}` };
      },
    });

    // Sub-agent mock: calls the suspending tool on first invocation
    const subAgentModel = makeSubAgentModelWithTool('info-gatherer-tool', { query: 'supervisor test query' });

    const subAgent = new Agent({
      id: 'suspending-sub-agent',
      name: 'Suspending Sub Agent',
      description: 'An agent that gathers information using a suspending tool.',
      instructions: 'You gather information using the info-gatherer-tool.',
      model: subAgentModel,
      tools: { suspendingTool },
    });

    const supervisorAgent = new Agent({
      id: 'suspension-supervisor',
      name: 'Suspension Supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('suspendingSubAgent', 'gather information'),
      agents: { suspendingSubAgent: subAgent },
      memory: new MockMemory(),
    });

    new Mastra({
      agents: { suspensionSupervisor: supervisorAgent },
      storage: mockStorage,
    });

    // First generate: should suspend waiting for info
    const output = await supervisorAgent.generate('Gather some info', {
      maxSteps: 5,
      memory: {
        thread: 'test-thread-suspension',
        resource: 'test-resource-suspension',
      },
    });

    expect(output.finishReason).toBe('suspended');
    expect(output.suspendPayload).toBeDefined();

    // Resume with the required info
    const resumeOutput = await supervisorAgent.resumeGenerate(
      { extraInfo: 'the answer is 42' },
      {
        runId: output.runId!,
        memory: {
          thread: 'test-thread-suspension',
          resource: 'test-resource-suspension',
        },
      },
    );

    // After resuming, execution should complete
    expect(resumeOutput.finishReason).toBe('stop');
    expect(resumeOutput.suspendPayload).toBeUndefined();
  });
});

/**
 * IsTaskComplete scorers in supervisor pattern.
 * Tests that isTaskComplete scorers work alongside the supervisor's delegation system.
 */
describe('Supervisor Pattern - IsTaskComplete scorers', () => {
  it('should run isTaskComplete scorers after each iteration in supervisor generate()', async () => {
    const scorerRun = vi.fn().mockResolvedValue({ score: 1, reason: 'Task is complete' });
    const mockScorer = {
      id: 'supervisor-test-scorer',
      name: 'Supervisor Test Scorer',
      run: scorerRun,
    };

    const supervisorAgent = new Agent({
      id: 'scorer-supervisor',
      name: 'Scorer Supervisor',
      instructions: 'You complete tasks.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Task completed successfully.',
          content: [{ type: 'text' as const, text: 'Task completed successfully.' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Task completed successfully.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      }),
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];

    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 3,
      isTaskComplete: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    // Scorer should have been called for the completed iteration
    expect(scorerRun).toHaveBeenCalled();

    // isTaskComplete events should have been emitted
    expect(isTaskCompleteEvents.length).toBeGreaterThan(0);
    expect(isTaskCompleteEvents[0].payload.passed).toBe(true);
  });

  it('should continue iterating when isTaskComplete scorer fails and stop when it passes', async () => {
    let scorerCallCount = 0;
    // Scorer fails on first call, passes on second
    const adaptiveScorer = {
      id: 'adaptive-scorer',
      name: 'Adaptive Scorer',
      run: vi.fn().mockImplementation(async () => {
        scorerCallCount++;
        if (scorerCallCount === 1) {
          return { score: 0, reason: 'Task not complete yet' };
        }
        return { score: 1, reason: 'Task is complete' };
      }),
    };

    let modelCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'adaptive-scorer-supervisor',
      name: 'Adaptive Scorer Supervisor',
      instructions: 'You complete tasks iteratively.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          modelCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Iteration ${modelCallCount} response.`,
            content: [{ type: 'text' as const, text: `Iteration ${modelCallCount} response.` }],
            warnings: [],
          };
        },
        doStream: async () => {
          modelCallCount++;
          const iteration = modelCallCount;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${iteration}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: `Iteration ${iteration} response.` },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 5,
      isTaskComplete: { scorers: [adaptiveScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    // Scorer should have been called twice (once failing, once passing)
    expect(adaptiveScorer.run).toHaveBeenCalledTimes(2);

    // Model should have been invoked at least twice (due to failed scorer triggering re-run)
    expect(modelCallCount).toBeGreaterThanOrEqual(2);

    // Should have 2 isTaskComplete events: one failed, one passed
    expect(isTaskCompleteEvents.length).toBe(2);
    expect(isTaskCompleteEvents[0].payload.passed).toBe(false);
    expect(isTaskCompleteEvents[1].payload.passed).toBe(true);
  });
});

/**
 * onIterationComplete Hook Integration in supervisor pattern.
 * Tests that the onIterationComplete hook is called after each iteration in the supervisor pattern.
 */
describe('Supervisor Pattern - onIterationComplete Hook Integration', () => {
  it('should call onIterationComplete hook after each iteration', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'simple-tool',
      description: 'A simple tool',
      inputSchema: z.object({
        input: z.string(),
      }),
      execute: async () => {
        return { result: 'Tool executed' };
      },
    });

    // Create model that generates tool call then responds
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You use tools and respond',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: return tool call
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  args: { input: 'test' },
                },
              ],
              warnings: [],
            };
          }
          // Second call: return text response
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Final response after tool',
            content: [{ type: 'text', text: 'Final response after tool' }],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            // First call: return tool call
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call-start',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                },
                {
                  type: 'tool-call-args-delta',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  argsDelta: '{"input":"test"}',
                },
                {
                  type: 'tool-call-end',
                  id: 'call-1',
                  toolCallId: 'call-1',
                  toolName: 'simple-tool',
                  args: { input: 'test' },
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }
          // Second call: return text response
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Final response after tool' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      tools: {
        simpleTool,
      },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('test-agent');

    await testAgent.generate('Use tool then respond', {
      maxSteps: 5,
      onIterationComplete: (ctx: IterationCompleteContext) => {
        iterations.push(ctx.iteration);
      },
    });

    // Two iterations: one for the tool call, one for the final stop response
    expect(iterations).toEqual([1, 2]);
  });

  it('should stop iteration when onIterationComplete returns continue: false', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'counter-tool',
      description: 'Counts calls',
      inputSchema: z.object({
        count: z.number(),
      }),
      execute: async ({ count }) => {
        return { result: `Count: ${count}` };
      },
    });

    const agent = new Agent({
      id: 'counter-agent',
      name: 'Counter Agent',
      instructions: 'You keep calling the counter tool',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          // Always return tool calls to test stopping
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call',
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                args: { count: callCount },
              },
            ],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call-start',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
              },
              {
                type: 'tool-call-args-delta',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                argsDelta: `{"count":${callCount}}`,
              },
              {
                type: 'tool-call-end',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'counter-tool',
                args: { count: callCount },
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      tools: {
        simpleTool,
      },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'counter-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('counter-agent');

    await testAgent.generate('Keep counting', {
      maxSteps: 10,
      onIterationComplete: (ctx: IterationCompleteContext) => {
        iterations.push(ctx.iteration);
        // Stop after 2 iterations
        if (ctx.iteration >= 2) {
          return { continue: false };
        }
        return { continue: true };
      },
    });

    // Hook returns continue: false at iteration >= 2, so exactly 2 iterations fire
    expect(iterations).toEqual([1, 2]);
  });

  it('should deliver feedback and allow one more LLM turn when continue:false with feedback', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'lookup-tool',
      description: 'Looks up data',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ result: `Found: ${query}` }),
    });

    const agent = new Agent({
      id: 'feedback-stop-agent',
      name: 'Feedback Stop Agent',
      instructions: 'You look up data and summarize findings.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount <= 2) {
            // First two calls: make tool calls (isContinued = true)
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call-start',
                  id: `call-${callCount}`,
                  toolCallId: `call-${callCount}`,
                  toolName: 'lookup-tool',
                },
                {
                  type: 'tool-call-args-delta',
                  id: `call-${callCount}`,
                  toolCallId: `call-${callCount}`,
                  toolName: 'lookup-tool',
                  argsDelta: `{"query":"item-${callCount}"}`,
                },
                {
                  type: 'tool-call-end',
                  id: `call-${callCount}`,
                  toolCallId: `call-${callCount}`,
                  toolName: 'lookup-tool',
                  args: { query: `item-${callCount}` },
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }
          // Third call (after feedback): produce final text
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-final', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Summary of findings' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          };
        },
      }),
      tools: { simpleTool },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: { 'feedback-stop-agent': agent },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('feedback-stop-agent');

    const result = await testAgent.stream('Find items', {
      maxSteps: 10,
      onIterationComplete: ctx => {
        iterations.push(ctx.iteration);
        if (ctx.iteration >= 2) {
          return { continue: false, feedback: 'Stop and summarize your findings.' };
        }
        return { continue: true };
      },
    });

    const reader = result.fullStream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const text = await result.text;

    // Iteration 2 returns continue:false + feedback → model gets one more turn (iteration 3)
    expect(iterations.length).toBeGreaterThanOrEqual(3);
    // The final LLM turn should produce text (not empty)
    expect(text).toBe('Summary of findings');
    // The model should have been called 3 times: 2 tool-call iterations + 1 final text
    expect(callCount).toBe(3);
  });

  it('should force-stop after the feedback turn even if model keeps making tool calls', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const simpleTool = createTool({
      id: 'fetch-tool',
      description: 'Fetches data',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ data: `result-${id}` }),
    });

    const agent = new Agent({
      id: 'stubborn-agent',
      name: 'Stubborn Agent',
      instructions: 'You keep fetching data.',
      model: new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          // Always return tool calls — model never voluntarily stops
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call-start',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'fetch-tool',
              },
              {
                type: 'tool-call-args-delta',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'fetch-tool',
                argsDelta: `{"id":"${callCount}"}`,
              },
              {
                type: 'tool-call-end',
                id: `call-${callCount}`,
                toolCallId: `call-${callCount}`,
                toolName: 'fetch-tool',
                args: { id: `${callCount}` },
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      tools: { simpleTool },
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: { 'stubborn-agent': agent },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('stubborn-agent');

    const result = await testAgent.stream('Fetch everything', {
      maxSteps: 20,
      onIterationComplete: ctx => {
        iterations.push(ctx.iteration);
        if (ctx.iteration === 1) {
          return { continue: false, feedback: 'Wrap up now.' };
        }
      },
    });

    const reader = result.fullStream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Iteration 1: tool call, hook returns continue:false + feedback
    // Iteration 2: model gets one more turn (feedback delivered), then pendingFeedbackStop fires
    // Iteration 3 should NOT happen — loop is force-stopped
    expect(iterations).toEqual([1, 2]);
    expect(callCount).toBe(2);
  });

  it('should add feedback to conversation when provided', async () => {
    const feedbackMessages: string[] = [];
    let callCount = 0;

    const agent = new Agent({
      id: 'feedback-agent',
      name: 'Feedback Agent',
      instructions: 'You respond to feedback',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          callCount++;

          // Check if feedback was added to messages
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          const feedbackMsg = messages.find(
            (m: any) => typeof m.content === 'string' && m.content.includes('Please improve'),
          );
          if (feedbackMsg) {
            feedbackMessages.push((feedbackMsg as any).content);
          }

          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'First response',
              content: [{ type: 'text', text: 'First response' }],
              warnings: [],
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Improved response after feedback',
            content: [{ type: 'text', text: 'Improved response after feedback' }],
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          callCount++;

          // Check if feedback was added to messages
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          const feedbackMsg = messages.find(
            (m: any) => typeof m.content === 'string' && m.content.includes('Please improve'),
          );
          if (feedbackMsg) {
            feedbackMessages.push((feedbackMsg as any).content);
          }

          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'First response' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Improved response after feedback' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'feedback-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('feedback-agent');

    let iterationCount = 0;
    await testAgent.generate('Generate response', {
      maxSteps: 3,
      onIterationComplete: () => {
        iterationCount++;
        if (iterationCount === 1) {
          // Add feedback after first iteration
          return {
            continue: true,
            feedback: 'Please improve your response with more details.',
          };
        }
        return { continue: false }; // Stop after second iteration
      },
    });

    expect(iterationCount).toBe(2);
  });

  it('should allow onIterationComplete continue:true to override final stop in stream (issue #14134)', async () => {
    const iterations: number[] = [];
    let callCount = 0;

    const agent = new Agent({
      id: 'continue-override-stream-agent',
      name: 'Continue Override Stream Agent',
      instructions: 'You may take multiple turns.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'First response ',
              content: [{ type: 'text', text: 'First response ' }],
              warnings: [],
            };
          }

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Second response',
            content: [{ type: 'text', text: 'Second response' }],
            warnings: [],
          };
        },
        doStream: async () => {
          callCount++;
          const currentCall = callCount;
          const responseText = currentCall === 1 ? 'First response ' : 'Second response';

          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${currentCall}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: `text-${currentCall}` },
              { type: 'text-delta', id: `text-${currentCall}`, delta: responseText },
              { type: 'text-end', id: `text-${currentCall}` },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'continue-override-stream-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('continue-override-stream-agent');

    const result = await testAgent.stream('Take multiple turns', {
      maxSteps: 5,
      onIterationComplete: ctx => {
        iterations.push(ctx.iteration);
        if (ctx.iteration === 1) {
          return { continue: true };
        }
      },
    });

    const reader = result.fullStream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const text = await result.text;

    // When the model returns stop (isFinal), the hook's continue:true should be
    // able to request another iteration in the streaming supervisor loop.
    expect(iterations).toEqual([1, 2]);
    expect(callCount).toBe(2);
    expect(text).toBe('First response Second response');
  });

  it('should accept onIterationComplete configuration without errors', async () => {
    const hookMock = vi.fn(() => ({ continue: true }));

    const agent = new Agent({
      id: 'test-agent',
      name: 'test agent',
      instructions: 'Test agent',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Response',
          content: [{ type: 'text', text: 'Response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      }),
      memory: new MockMemory(),
    });

    const mastra = new Mastra({
      agents: {
        'test-agent': agent,
      },
      storage: new InMemoryStore(),
    });

    const testAgent = mastra.getAgent('test-agent');

    // This should not throw an error
    const result = await testAgent.generate('Test', {
      maxSteps: 1,
      onIterationComplete: hookMock,
    });

    expect(result).toBeDefined();
    expect(result.text).toBe('Response');

    // Hook should be called after the iteration
    expect(hookMock).toHaveBeenCalled();
  });
});

/**
 * IsTaskComplete feedback tests for the supervisor pattern.
 * Tests scorer strategies, suppressFeedback flag, and multi-iteration callbacks.
 *
 * Key differences from agent-network.test.ts:
 * - Supervisor uses is-task-complete-step.ts (stream-based scorers).
 * - `suppressFeedback` stores a flag in the is-task-complete chunk payload and in the
 *   feedback message's metadata; it does NOT prevent the message from being added to
 *   the messageList or from being sent to the model in the next iteration.
 * - maxSteps does NOT terminate the loop when an isTaskComplete scorer keeps failing
 *   (unlike the network flow).  Always ensure a scorer eventually passes to avoid
 *   an infinite loop.
 */
describe('Supervisor Pattern - IsTaskComplete feedback', () => {
  it('should require all scorers to pass with "all" strategy', async () => {
    const passingScorer = {
      id: 'passing-scorer',
      name: 'Passing Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Passed' }),
    };

    let adaptiveScorerCallCount = 0;
    const adaptiveScorer = {
      id: 'adaptive-scorer',
      name: 'Adaptive Scorer',
      run: vi.fn().mockImplementation(async () => {
        adaptiveScorerCallCount++;
        return adaptiveScorerCallCount === 1
          ? { score: 0, reason: 'Not yet complete' }
          : { score: 1, reason: 'Now complete' };
      }),
    };

    let modelCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'all-strategy-supervisor',
      name: 'All Strategy Supervisor',
      instructions: 'You complete tasks.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          modelCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Response ${modelCallCount}`,
            content: [{ type: 'text' as const, text: `Response ${modelCallCount}` }],
            warnings: [],
          };
        },
        doStream: async () => {
          modelCallCount++;
          const iter = modelCallCount;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${iter}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: `Response ${iter}` },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 5,
      isTaskComplete: {
        scorers: [passingScorer as any, adaptiveScorer as any],
        strategy: 'all',
      },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    // Iter 1: adaptiveScorer fails → overall passed=false (strategy 'all' requires all to pass)
    expect(isTaskCompleteEvents[0].payload.passed).toBe(false);
    expect(isTaskCompleteEvents[0].payload.results).toHaveLength(2);

    // Iter 2: both scorers pass → overall passed=true
    expect(isTaskCompleteEvents[1].payload.passed).toBe(true);
    expect(isTaskCompleteEvents.length).toBe(2);

    expect(passingScorer.run).toHaveBeenCalledTimes(2);
    expect(adaptiveScorer.run).toHaveBeenCalledTimes(2);
  });

  it('should pass with one scorer using "any" strategy', async () => {
    const passingScorer = {
      id: 'passing-scorer',
      name: 'Passing Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Passed' }),
    };

    const failingScorer = {
      id: 'failing-scorer',
      name: 'Failing Scorer',
      run: vi.fn().mockResolvedValue({ score: 0, reason: 'Failed' }),
    };

    const supervisorAgent = new Agent({
      id: 'any-strategy-supervisor',
      name: 'Any Strategy Supervisor',
      instructions: 'You complete tasks.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Done',
          content: [{ type: 'text' as const, text: 'Done' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      }),
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      isTaskComplete: {
        scorers: [passingScorer as any, failingScorer as any],
        strategy: 'any',
      },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    // With 'any' strategy, one passing scorer is enough
    expect(isTaskCompleteEvents).toHaveLength(1);
    expect(isTaskCompleteEvents[0].payload.passed).toBe(true);
    expect(isTaskCompleteEvents[0].payload.results).toHaveLength(2);
    expect(passingScorer.run).toHaveBeenCalled();
    expect(failingScorer.run).toHaveBeenCalled();
  });

  it('should include scorer results and reason in is-task-complete event', async () => {
    const mockScorer = {
      id: 'detailed-scorer',
      name: 'Detailed Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Task clearly completed with all requirements met' }),
    };

    const supervisorAgent = new Agent({
      id: 'scorer-results-supervisor',
      name: 'Scorer Results Supervisor',
      instructions: 'You complete tasks.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Task done',
          content: [{ type: 'text' as const, text: 'Task done' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Task done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      }),
      memory: new MockMemory(),
    });

    let isTaskCompleteEvent: any;
    const stream = await supervisorAgent.stream('Do the task', {
      isTaskComplete: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvent = chunk;
      }
    }

    expect(isTaskCompleteEvent).toBeDefined();
    expect(isTaskCompleteEvent.payload.results).toHaveLength(1);
    // ScorerResult uses scorerId/scorerName (not id/name)
    expect(isTaskCompleteEvent.payload.results[0].scorerId).toBe('detailed-scorer');
    expect(isTaskCompleteEvent.payload.results[0].reason).toBe('Task clearly completed with all requirements met');
    expect(isTaskCompleteEvent.payload.passed).toBe(true);
  });

  it('should report suppressFeedback: true in is-task-complete event when configured', async () => {
    const passingScorer = {
      id: 'scorer',
      name: 'Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Done' }),
    };

    const makeStreamModel = () =>
      new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Done',
          content: [{ type: 'text' as const, text: 'Done' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });

    // With suppressFeedback: true
    const agentWithSuppression = new Agent({
      id: 'suppress-feedback-supervisor',
      name: 'Suppress Feedback Supervisor',
      instructions: 'You complete tasks.',
      model: makeStreamModel(),
      memory: new MockMemory(),
    });

    let chunkWithSuppression: any;
    const stream1 = await agentWithSuppression.stream('Do task', {
      isTaskComplete: { scorers: [passingScorer as any], suppressFeedback: true },
    });
    for await (const chunk of stream1.fullStream) {
      if (chunk.type === 'is-task-complete') chunkWithSuppression = chunk;
    }
    expect(chunkWithSuppression.payload.suppressFeedback).toBe(true);

    // Without suppressFeedback (default: false)
    const agentDefault = new Agent({
      id: 'default-feedback-supervisor',
      name: 'Default Feedback Supervisor',
      instructions: 'You complete tasks.',
      model: makeStreamModel(),
      memory: new MockMemory(),
    });

    let chunkDefault: any;
    const stream2 = await agentDefault.stream('Do task', {
      isTaskComplete: { scorers: [passingScorer as any] },
    });
    for await (const chunk of stream2.fullStream) {
      if (chunk.type === 'is-task-complete') chunkDefault = chunk;
    }
    expect(chunkDefault.payload.suppressFeedback).toBe(false);
  });

  it('should call onIterationComplete for each iteration in multi-iteration run', async () => {
    const iterationCallbacks: any[] = [];
    let scorerCallCount = 0;

    // Scorer fails on calls 1 and 2, passes on call 3
    const mockScorer = {
      id: 'multi-iter-scorer',
      name: 'Multi Iteration Scorer',
      run: vi.fn().mockImplementation(async () => {
        scorerCallCount++;
        if (scorerCallCount < 3) {
          return { score: 0, reason: `Attempt ${scorerCallCount} not complete` };
        }
        return { score: 1, reason: 'Finally complete' };
      }),
    };

    let modelCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'multi-iter-callback-supervisor',
      name: 'Multi Iteration Callback Supervisor',
      instructions: 'You complete tasks iteratively.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          modelCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Response ${modelCallCount}`,
            content: [{ type: 'text' as const, text: `Response ${modelCallCount}` }],
            warnings: [],
          };
        },
        doStream: async () => {
          modelCallCount++;
          const iter = modelCallCount;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${iter}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: `Response ${iter}` },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const stream = await supervisorAgent.stream('Complete a complex task', {
      maxSteps: 5,
      isTaskComplete: { scorers: [mockScorer as any] },
      onIterationComplete: context => {
        iterationCallbacks.push({ ...context });
      },
    });

    for await (const _chunk of stream.fullStream) {
      // consume stream
    }

    // Scorer fails 2x then passes → 3 iterations total
    expect(iterationCallbacks).toHaveLength(3);

    // First two iterations are not final
    expect(iterationCallbacks[0].isFinal).toBe(false);
    expect(iterationCallbacks[1].isFinal).toBe(false);

    // Last iteration is final (scorer passed → loop stops)
    expect(iterationCallbacks[2].isFinal).toBe(true);

    // Iteration numbers are 1-based (accumulatedSteps.length after push)
    expect(iterationCallbacks[0].iteration).toBe(1);
    expect(iterationCallbacks[1].iteration).toBe(2);
    expect(iterationCallbacks[2].iteration).toBe(3);
  });

  it('should report maxIterationReached in is-task-complete when iteration equals maxSteps', async () => {
    // Scorer fails on first call, passes on second — with maxSteps:2 the second iteration
    // has currentIteration (2) >= maxSteps (2), so maxIterationReached should be true.
    let scorerCallCount = 0;
    const mockScorer = {
      id: 'max-iter-scorer',
      name: 'Max Iteration Scorer',
      run: vi.fn().mockImplementation(async () => {
        scorerCallCount++;
        return scorerCallCount === 1
          ? { score: 0, reason: 'Not yet done' }
          : { score: 1, reason: 'Done on second attempt' };
      }),
    };

    let modelCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'max-iter-supervisor',
      name: 'Max Iteration Supervisor',
      instructions: 'You complete tasks.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          modelCallCount++;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: `Response ${modelCallCount}`,
            content: [{ type: 'text' as const, text: `Response ${modelCallCount}` }],
            warnings: [],
          };
        },
        doStream: async () => {
          modelCallCount++;
          const iter = modelCallCount;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${iter}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: `Response ${iter}` },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          };
        },
      }),
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 2,
      isTaskComplete: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    expect(isTaskCompleteEvents).toHaveLength(2);
    // First iteration (currentIteration=1): 1 >= 2 is false
    expect(isTaskCompleteEvents[0].payload.maxIterationReached).toBe(false);
    // Second iteration (currentIteration=2): 2 >= 2 is true
    expect(isTaskCompleteEvents[1].payload.maxIterationReached).toBe(true);
  });
});

describe('Supervisor Pattern - Message history transfer to sub-agents', () => {
  it('should forward the supervisor conversation history to the sub-agent as context', async () => {
    // When the supervisor delegates to a sub-agent tool, the sub-agent should
    // receive the supervisor's current conversation history so it can understand
    // the full context of what has been discussed.

    let subAgentReceivedPrompts: any[] = [];

    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subAgentReceivedPrompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Your name is Alice.',
          content: [{ type: 'text', text: 'Your name is Alice.' }],
          warnings: [],
        };
      },
    });

    const subAgent = new Agent({
      id: 'question-answer-agent',
      name: 'Question Answer Agent',
      description: 'An agent that answers questions based on conversation context',
      instructions: 'Answer questions based on the conversation history.',
      model: subAgentMockModel,
    });

    // Supervisor delegates to sub-agent once, then finishes
    let supervisorCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'supervisor-history-test',
      name: 'Supervisor History Test',
      instructions: 'Delegate questions to the question-answer-agent.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          supervisorCallCount++;
          if (supervisorCallCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-questionAnswerAgent',
                  input: JSON.stringify({ prompt: 'What is my name?' }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Your name is Alice.',
            content: [{ type: 'text', text: 'Your name is Alice.' }],
            warnings: [],
          };
        },
      }),
      agents: { questionAnswerAgent: subAgent },
      memory: new MockMemory(),
    });

    // Pass multiple messages as conversation history to the supervisor
    await supervisorAgent.generate(
      [
        { role: 'user', content: 'My name is Alice.' },
        { role: 'user', content: 'What is my name?' },
      ],
      { maxSteps: 3 },
    );

    // The sub-agent should have been called at least once
    expect(subAgentReceivedPrompts.length).toBeGreaterThan(0);

    // Verify the sub-agent received the prior user message from the supervisor's history
    const promptString = JSON.stringify(subAgentReceivedPrompts[subAgentReceivedPrompts.length - 1]);
    expect(promptString).toContain('My name is Alice');
  });

  it('should make isTaskComplete feedback visible to both the supervisor and sub-agents', async () => {
    // IsTaskComplete feedback (from failed scorers) is added as an assistant message to the
    // supervisor's own message list. The supervisor passes ALL messages (input + response,
    // including isTaskComplete feedback) as context to sub-agents. This means:
    //   - The SUPERVISOR'S LLM sees the feedback on its next call.
    //   - Sub-agents also see the feedback directly in their context, so they can produce
    //     a better response without the supervisor needing to relay the feedback.
    //
    // The test verifies:
    //   1. The supervisor loop continues when scorer fails (feedback keeps isContinued = true).
    //   2. is-task-complete events are emitted so the feedback is observable.
    //   3. IsTaskComplete feedback IS directly visible in sub-agent context on the second call.

    let supervisorLLMReceivedPrompts: any[] = [];
    let subAgentReceivedPrompts: any[] = [];

    // Sub-agent needs both doGenerate and doStream. When the supervisor calls stream(),
    // sub-agents are also invoked via agent.stream(), so doStream is what captures prompts.
    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subAgentReceivedPrompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Task completed.',
          content: [{ type: 'text', text: 'Task completed.' }],
          warnings: [],
        };
      },
      doStream: async ({ prompt }) => {
        subAgentReceivedPrompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sub-id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Task completed.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
          ]),
        };
      },
    });

    const subAgent = new Agent({
      id: 'sub-agent-feedback-visibility-test',
      name: 'Sub Agent Feedback Visibility Test',
      description: 'A sub-agent for feedback visibility testing',
      instructions: 'Complete the assigned task.',
      model: subAgentMockModel,
    });

    // Scorer: fails first call, passes on second
    let scorerCallCount = 0;
    const mockScorer = {
      id: 'fail-then-pass-scorer',
      name: 'Fail Then Pass Scorer',
      run: vi.fn().mockImplementation(async () => {
        scorerCallCount++;
        if (scorerCallCount === 1) {
          return { score: 0, reason: 'Task not complete yet, needs more work' };
        }
        return { score: 1, reason: 'Task is now complete' };
      }),
    };

    // The isTaskComplete step runs only when isContinued = false (finish reason: stop).
    // Sequence:
    //   call 1: tool-call → sub-agent call 1 (isContinued = true, check skipped)
    //   call 2: stop      → isTaskComplete check runs, scorer FAILS, feedback added to supervisor context
    //   call 3: tool-call → sub-agent call 2 (supervisor's LLM has seen the feedback)
    //   call 4: stop      → isTaskComplete check runs, scorer PASSES, loop ends
    let supervisorCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'supervisor-feedback-visibility',
      name: 'Supervisor Feedback Visibility',
      instructions: 'Delegate work to the sub-agent.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          supervisorCallCount++;
          supervisorLLMReceivedPrompts.push(prompt);
          if (supervisorCallCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'Do the task (attempt 1)' }),
                },
              ],
              warnings: [],
            };
          }
          if (supervisorCallCount === 2) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: 'Partial progress, will try again.',
              content: [{ type: 'text', text: 'Partial progress, will try again.' }],
              warnings: [],
            };
          }
          if (supervisorCallCount === 3) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-3',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'Do the task (attempt 2)' }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'All done.',
            content: [{ type: 'text', text: 'All done.' }],
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          supervisorCallCount++;
          supervisorLLMReceivedPrompts.push(prompt);
          const call = supervisorCallCount;
          if (call === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'Do the task (attempt 1)' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }
          if (call === 2) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Partial progress, will try again.' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
              ]),
            };
          }
          if (call === 3) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-3',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'Do the task (attempt 2)' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'All done.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
          };
        },
      }),
      agents: { subAgent },
      memory: new MockMemory(),
    });

    const isTaskCompleteEvents: any[] = [];
    const result = await supervisorAgent.stream('Complete a multi-part task', {
      maxSteps: 6,
      isTaskComplete: { scorers: [mockScorer as any] },
    });

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'is-task-complete') {
        isTaskCompleteEvents.push(chunk);
      }
    }

    // Scorer ran twice: once failing, once passing
    expect(scorerCallCount).toBeGreaterThanOrEqual(2);

    // Sub-agent called for each delegation
    expect(subAgentReceivedPrompts.length).toBeGreaterThanOrEqual(2);

    // is-task-complete events were emitted — the feedback is observable in the supervisor stream
    expect(isTaskCompleteEvents).toHaveLength(2);
    expect(isTaskCompleteEvents[0].payload.passed).toBe(false);
    expect(isTaskCompleteEvents[1].payload.passed).toBe(true);

    // Verify the supervisor's LLM received the isTaskComplete feedback in its THIRD call.
    // The feedback is an assistant message in the supervisor's context, visible to the
    // supervisor LLM so it can craft better delegation prompts in subsequent iterations.
    const supervisorCall3Str = JSON.stringify(supervisorLLMReceivedPrompts[2]);
    expect(supervisorCall3Str).toContain('Completion Check Results');
    expect(supervisorCall3Str).toContain('NOT COMPLETE');

    // Sub-agents now receive ALL supervisor messages as context (including isTaskComplete feedback),
    // because tool context passes all messages (input + response). The feedback is directly
    // visible to the sub-agent on its second call so it can produce a better response.
    const subAgentCall2Str = JSON.stringify(subAgentReceivedPrompts[1]);
    expect(subAgentCall2Str).toContain('Completion Check Results');
    expect(subAgentCall2Str).toContain('NOT COMPLETE');
    expect(subAgentCall2Str).toContain('Complete a multi-part task');
  });

  it('should allow messageFilter to customise which messages are forwarded to the sub-agent', async () => {
    // The optional delegation.messageFilter callback lets callers control exactly
    // which supervisor context messages are forwarded to sub-agents.

    let subAgentReceivedPrompts: any[] = [];
    const filteredMessages: any[] = [];

    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subAgentReceivedPrompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Done.',
          content: [{ type: 'text', text: 'Done.' }],
          warnings: [],
        };
      },
    });

    const subAgent = new Agent({
      id: 'sub-agent-filter-test',
      name: 'Sub Agent Filter Test',
      description: 'A sub-agent for testing context filtering',
      instructions: 'Do the task.',
      model: subAgentMockModel,
    });

    let supervisorCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'supervisor-context-filter',
      name: 'Supervisor Context Filter',
      instructions: 'Delegate to sub-agent.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          supervisorCallCount++;
          if (supervisorCallCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'Do the task' }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Done.',
            content: [{ type: 'text', text: 'Done.' }],
            warnings: [],
          };
        },
      }),
      agents: { subAgent },
      memory: new MockMemory(),
    });

    // Pass two user messages, but the messageFilter will keep only the most recent one
    await supervisorAgent.generate(
      [
        { role: 'user', content: 'SECRET: do not share this' },
        { role: 'user', content: 'Do the task please' },
      ],
      {
        maxSteps: 3,
        delegation: {
          messageFilter: async ({ messages }) => {
            // Only forward messages that don't contain "SECRET"
            const filtered = messages.filter((m: any) => {
              const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
              return !content.includes('SECRET');
            });
            filteredMessages.push(...filtered);
            return filtered;
          },
        },
      },
    );

    expect(subAgentReceivedPrompts.length).toBeGreaterThan(0);

    // Sub-agent should NOT have received the SECRET message
    const promptStr = JSON.stringify(subAgentReceivedPrompts[subAgentReceivedPrompts.length - 1]);
    expect(promptStr).not.toContain('SECRET');

    // Sub-agent SHOULD have received the non-secret task message
    expect(promptStr).toContain('Do the task please');
  });

  it('should save only the last user message and response to sub-agent memory (not full supervisor context)', async () => {
    // The supervisor forwards ALL messages as context to the sub-agent (so it can see
    // the full conversation history), but only the immediate delegation prompt + response
    // should be saved to the sub-agent's thread memory. This prevents the sub-agent's
    // memory from being polluted with the entire supervisor conversation history.

    let subAgentReceivedPrompts: any[] = [];

    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subAgentReceivedPrompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          // text: 'Your name is alice',
          content: [{ type: 'text', text: 'Your name is Alice ' }],
          warnings: [],
        };
      },
    });

    const memoryStore = new InMemoryStore();
    const subAgentMemory = new MockMemory({ storage: memoryStore });

    const subAgent = new Agent({
      id: 'sub-agent-memory-isolation-test',
      name: 'Sub Agent Memory Isolation Test',
      description: 'A sub-agent for testing memory isolation',
      instructions: 'Answer questions.',
      model: subAgentMockModel,
      memory: subAgentMemory,
    });

    let supervisorCallCount = 0;
    const supervisorAgent = new Agent({
      id: 'supervisor-memory-isolation',
      name: 'Supervisor Memory Isolation',
      instructions: 'Delegate to sub-agent.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          supervisorCallCount++;
          if (supervisorCallCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'What is my name?', threadId, resourceId }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            // text: 'Sub-agent says: Sub-agent response',
            content: [{ type: 'text', text: 'Sub-agent says: Your name is Alice' }],
            warnings: [],
          };
        },
      }),
      agents: { subAgent },
      memory: new MockMemory(),
    });

    const resourceId = randomUUID();
    const threadId = randomUUID();

    // Supervisor conversation has multiple user messages
    await supervisorAgent.generate(
      [
        { role: 'user', content: 'My name is Alice.' },
        { role: 'user', content: 'I live in Paris.' },
        { role: 'user', content: 'What is my name?' },
      ],
      {
        maxSteps: 3,
        memory: {
          resource: resourceId,
          thread: threadId,
        },
      },
    );

    // PART 1: Verify full context IS forwarded to sub-agent
    // Sub-agent should have received the full supervisor context (all 3 user messages + tool results)
    expect(subAgentReceivedPrompts.length).toBeGreaterThan(0);
    const promptStr = JSON.stringify(subAgentReceivedPrompts[0]);
    expect(promptStr).toContain('My name is Alice');
    expect(promptStr).toContain('I live in Paris');
    expect(promptStr).toContain('What is my name');

    // PART 2: Verify only delegation prompt + response are saved to sub-agent memory
    // When the supervisor doesn't pass memory config to generate(), the tool execution
    // context has undefined threadId/resourceId. The sub-agent resource ID becomes
    // `undefined-${agentName}` where agentName is extracted from tool name `agent-subAgent` → `subAgent`
    const subAgentResourceId = `${resourceId}-subAgent`;
    const memoryStorage = await subAgentMemory.storage.getStore('memory');

    expect(memoryStorage).toBeDefined();

    if (memoryStorage) {
      const allThreadsResult = await memoryStorage.listThreads({ filter: { resourceId: subAgentResourceId } });
      const allThreads = allThreadsResult.threads;

      // Should have exactly one thread (the sub-agent's thread for this delegation)
      expect(allThreads.length).toBeGreaterThan(0);

      // Get the first thread (there should only be one for this test)
      const subAgentThread = allThreads[0];
      expect(subAgentThread).toBeDefined();

      if (subAgentThread) {
        // Get messages from the sub-agent's thread
        const subAgentMessages = await memoryStorage.listMessages({
          threadId: subAgentThread.id,
          perPage: 100,
        });

        // Verify memory isolation: Should have 2-3 messages
        // (delegation prompt + response, possibly a duplicate response artifact)
        expect(subAgentMessages.messages.length).toBeGreaterThanOrEqual(2);
        expect(subAgentMessages.messages.length).toBeLessThanOrEqual(3);

        // First message should be the delegation prompt (user role)
        expect(subAgentMessages.messages[0].role).toBe('user');
        const userContent =
          typeof subAgentMessages.messages[0].content === 'string'
            ? subAgentMessages.messages[0].content
            : JSON.stringify(subAgentMessages.messages[0].content);
        expect(userContent).toContain('What is my name');

        // Second message should be the sub-agent's response (assistant role)
        expect(subAgentMessages.messages[1].role).toBe('assistant');
        const assistantContent =
          typeof subAgentMessages.messages[1].content === 'string'
            ? subAgentMessages.messages[1].content
            : JSON.stringify(subAgentMessages.messages[1].content);
        expect(assistantContent).toContain('Your name is Alice');

        // CRITICAL: The saved messages should NOT include the supervisor's earlier context
        // This confirms that lastMessages: 0 + explicit save prevents memory pollution
        const allSavedContent = JSON.stringify(subAgentMessages.messages);
        expect(allSavedContent).not.toContain('My name is Alice');
        expect(allSavedContent).not.toContain('I live in Paris');
      }
    }
  });

  it('should isolate sub-agent memory when threadId and resourceId are set via requestContext reserved keys', async () => {
    const subAgentMockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        content: [{ type: 'text', text: 'Sub-agent response' }],
        warnings: [],
      }),
    });

    const memoryStore = new InMemoryStore();
    const subAgentMemory = new MockMemory({ storage: memoryStore });

    const subAgent = new Agent({
      id: 'sub-agent-reserved-keys-test',
      name: 'Sub Agent Reserved Keys Test',
      description: 'A sub-agent for testing reserved key isolation',
      instructions: 'Answer questions.',
      model: subAgentMockModel,
      memory: subAgentMemory,
    });

    let supervisorCallCount = 0;
    const resourceId = randomUUID();
    const threadId = randomUUID();

    const supervisorAgent = new Agent({
      id: 'supervisor-reserved-keys',
      name: 'Supervisor Reserved Keys',
      instructions: 'Delegate to sub-agent.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          supervisorCallCount++;
          if (supervisorCallCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-subAgent',
                  input: JSON.stringify({ prompt: 'What is my name?', threadId, resourceId }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [{ type: 'text', text: 'Sub-agent says: Sub-agent response' }],
            warnings: [],
          };
        },
      }),
      agents: { subAgent },
      memory: new MockMemory(),
    });

    // Set reserved keys on requestContext (simulates middleware + body merge)
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    await supervisorAgent.generate([{ role: 'user', content: 'What is my name?' }], {
      maxSteps: 3,
      requestContext,
      memory: {
        resource: resourceId,
        thread: threadId,
      },
    });

    // Sub-agent should have its own isolated thread, not the parent's
    const subAgentResourceId = `${resourceId}-subAgent`;
    const memoryStorage = await subAgentMemory.storage.getStore('memory');
    expect(memoryStorage).toBeDefined();

    if (memoryStorage) {
      const allThreadsResult = await memoryStorage.listThreads({ filter: { resourceId: subAgentResourceId } });
      const allThreads = allThreadsResult.threads;

      // Sub-agent should have its own thread
      expect(allThreads.length).toBeGreaterThan(0);

      const subAgentThread = allThreads[0];
      expect(subAgentThread).toBeDefined();

      if (subAgentThread) {
        // Sub-agent thread ID should NOT be the parent's thread ID
        expect(subAgentThread.id).not.toBe(threadId);

        const subAgentMessages = await memoryStorage.listMessages({
          threadId: subAgentThread.id,
          perPage: 100,
        });

        expect(subAgentMessages.messages.length).toBeGreaterThanOrEqual(2);

        // First message should be the delegation prompt
        expect(subAgentMessages.messages[0].role).toBe('user');
        const userContent =
          typeof subAgentMessages.messages[0].content === 'string'
            ? subAgentMessages.messages[0].content
            : JSON.stringify(subAgentMessages.messages[0].content);
        expect(userContent).toContain('What is my name');

        // Second message should be the sub-agent's response
        expect(subAgentMessages.messages[1].role).toBe('assistant');
      }
    }

    // Verify reserved keys are restored for the parent after sub-agent execution
    expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe(threadId);
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe(resourceId);
  });

  describe('Sub-agent instructions merge', () => {
    it('should preserve sub-agent own instructions when parent LLM provides instructions via tool call', async () => {
      const capturedSystemMessages: string[] = [];

      const subAgentModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          for (const msg of messages) {
            if ((msg as any).role === 'system') {
              const content = (msg as any).content;
              if (typeof content === 'string') {
                capturedSystemMessages.push(content);
              } else if (Array.isArray(content)) {
                for (const part of content) {
                  if (part.type === 'text') capturedSystemMessages.push(part.text);
                }
              }
            }
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: 'Sub-agent response',
            content: [{ type: 'text', text: 'Sub-agent response' }],
            warnings: [],
          };
        },
      });

      const subAgent = new Agent({
        id: 'research-agent',
        name: 'research-agent',
        description: 'A research sub-agent',
        instructions: 'You are a research assistant. Always cite your sources.',
        model: subAgentModel,
      });

      let callCount = 0;
      const supervisorModel = new MockLanguageModelV2({
        doGenerate: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call-1',
                  toolName: 'agent-researchAgent',
                  input: JSON.stringify({
                    prompt: 'Find information about TypeScript',
                    instructions: 'Be concise and use bullet points',
                  }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: 'Done',
            content: [{ type: 'text', text: 'Done' }],
            warnings: [],
          };
        },
      });

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { researchAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Research TypeScript', { maxSteps: 3 });

      const allSystemText = capturedSystemMessages.join('\n');
      expect(allSystemText).toContain('You are a research assistant. Always cite your sources.');
      expect(allSystemText).toContain('Be concise and use bullet points');

      const ownIdx = allSystemText.indexOf('You are a research assistant. Always cite your sources.');
      const llmIdx = allSystemText.indexOf('Be concise and use bullet points');
      expect(ownIdx).toBeLessThan(llmIdx);
    });

    it('should use only agent own instructions when parent LLM does not provide instructions', async () => {
      const capturedSystemMessages: string[] = [];

      const subAgentModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          const messages = Array.isArray(prompt) ? prompt : [prompt];
          for (const msg of messages) {
            if ((msg as any).role === 'system') {
              const content = (msg as any).content;
              if (typeof content === 'string') {
                capturedSystemMessages.push(content);
              } else if (Array.isArray(content)) {
                for (const part of content) {
                  if (part.type === 'text') capturedSystemMessages.push(part.text);
                }
              }
            }
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: 'Sub-agent response',
            content: [{ type: 'text', text: 'Sub-agent response' }],
            warnings: [],
          };
        },
      });

      const subAgent = new Agent({
        id: 'helper-agent',
        name: 'helper-agent',
        description: 'A helper sub-agent',
        instructions: 'You are a helpful assistant. Be thorough.',
        model: subAgentModel,
      });

      const supervisorModel = makeSupervisorModel('helperAgent', 'Help me with something');

      const supervisorAgent = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'You orchestrate sub-agents.',
        model: supervisorModel,
        agents: { helperAgent: subAgent },
        memory: new MockMemory(),
      });

      await supervisorAgent.generate('Help me', { maxSteps: 3 });

      const allSystemText = capturedSystemMessages.join('\n');
      expect(allSystemText).toContain('You are a helpful assistant. Be thorough.');
    });
  });
});

describe('Supervisor Pattern - Sub-agent context across multiple generate calls', () => {
  it('should forward supervisor text conversation to sub-agent on subsequent generate calls via memory', async () => {
    // Scenario: Supervisor delegates to a sub-agent which "creates" a record.
    // On a second generate() call, the supervisor delegates to the same sub-agent again.
    // The sub-agent should see the supervisor's text conversation history (user messages
    // and assistant text responses) but NOT the raw agent-* tool call/result pairs,
    // since those reference tools the sub-agent doesn't have.

    const subAgentReceivedPrompts: any[][] = [];

    // Sub-agent model: captures prompts to verify what context it receives
    let subCallCount = 0;
    const subAgentModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        subCallCount++;
        subAgentReceivedPrompts.push(prompt as any[]);

        if (subCallCount === 1) {
          // First delegation: simulate calling a tool to create a record
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'create-call-1',
                toolName: 'createRecord',
                input: JSON.stringify({ name: 'Test Record' }),
              },
            ],
            warnings: [],
          };
        }

        // All subsequent calls: respond with text
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: subCallCount === 2 ? 'Created record with ID rec_12345' : 'Updated record rec_12345',
          content: [
            {
              type: 'text' as const,
              text: subCallCount === 2 ? 'Created record with ID rec_12345' : 'Updated record rec_12345',
            },
          ],
          warnings: [],
        };
      },
    });

    const createRecordTool = createTool({
      id: 'create-record',
      description: 'Creates a record',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => ({ id: 'rec_12345', name, status: 'active' }),
    });

    const subAgent = new Agent({
      id: 'record-agent',
      name: 'record-agent',
      description: 'Manages records - creates and updates them',
      instructions: 'You manage records.',
      model: subAgentModel,
      tools: { createRecord: createRecordTool },
    });

    // Supervisor model: delegates to record-agent on each generate() call
    // The supervisor's final text response includes the record ID so context
    // flows through text conversation rather than leaked tool results.
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doGenerate: async () => {
        supervisorCallCount++;
        // Odd calls: delegate to sub-agent
        if (supervisorCallCount % 2 === 1) {
          const prompt = supervisorCallCount === 1 ? 'Create a new record named Test Record' : 'Update the record';
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${supervisorCallCount}`,
                toolName: 'agent-recordAgent',
                input: JSON.stringify({ prompt }),
              },
            ],
            warnings: [],
          };
        }
        // Even calls: final response includes context from delegation
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Record rec_12345 was created successfully.',
          content: [{ type: 'text' as const, text: 'Record rec_12345 was created successfully.' }],
          warnings: [],
        };
      },
    });

    const sharedMemory = new MockMemory();

    const supervisor = new Agent({
      id: 'supervisor-context-test',
      name: 'supervisor-context-test',
      instructions: 'You orchestrate record management via sub-agents.',
      model: supervisorModel,
      agents: { recordAgent: subAgent },
      memory: sharedMemory,
    });

    const threadId = 'ctx-test-thread';
    const resourceId = 'ctx-test-user';

    // First generate: supervisor delegates to sub-agent, sub-agent "creates" a record
    await supervisor.generate('Create a new record named Test Record', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
    });

    // Second generate: supervisor delegates to same sub-agent for a follow-up action
    await supervisor.generate('Update the record', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
    });

    // The sub-agent should have been called at least twice across both generate() calls:
    // - Calls 1-2 from first generate (tool-call + text response)
    // - Call 3 from second generate (text response for update)
    expect(subAgentReceivedPrompts.length).toBeGreaterThanOrEqual(3);

    // The sub-agent's prompt on the second delegation should contain the
    // supervisor's text response (which includes the record ID) — context
    // flows through the supervisor's text conversation, not leaked tool results.
    const secondDelegationPrompt = JSON.stringify(subAgentReceivedPrompts[2]);
    expect(secondDelegationPrompt).toContain('rec_12345');
    expect(secondDelegationPrompt).toContain('Record rec_12345 was created successfully.');

    // Verify no parent tool calls leaked into the sub-agent's context.
    // Only the sub-agent's own tool calls (e.g. createRecord) should appear.
    for (const prompt of subAgentReceivedPrompts) {
      for (const message of prompt) {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const toolCalls = message.content.filter((part: any) => part.type === 'tool-call');
          for (const tc of toolCalls) {
            expect(tc.toolName).toBe('createRecord');
          }
        }
      }
    }
  });
});

/**
 * Output processor propagation in streaming delegation.
 * Tests that when a sub-agent has an output processor that modifies text via processOutputResult,
 * the supervisor receives the processed text (not the raw LLM output).
 */
describe('Supervisor Pattern - Output processor propagation in streaming delegation', () => {
  const mockStorage = new InMemoryStore();

  afterEach(async () => {
    const workflowsStore = await mockStorage.getStore('workflows');
    await workflowsStore?.dangerouslyClearAll();
  });

  it('should propagate processOutputResult modifications to supervisor in streaming delegation', async () => {
    const RAW_SUB_AGENT_TEXT = 'raw sub-agent response';
    const PROCESSED_SUB_AGENT_TEXT = 'PROCESSED: raw sub-agent response';

    // Output processor that prepends "PROCESSED: " to the assistant message text
    const textTransformProcessor: Processor<'text-transform'> = {
      id: 'text-transform',
      async processOutputResult(args: ProcessOutputResultArgs) {
        const transformed: MastraDBMessage[] = args.messages.map(msg => {
          if (msg.role !== 'assistant') return msg;
          const parts = msg.content?.parts ?? [];
          return {
            ...msg,
            content: {
              ...msg.content,
              format: msg.content?.format ?? 2,
              parts: parts.map((part: any) => {
                if (part.type === 'text') {
                  return { ...part, text: `PROCESSED: ${part.text}` };
                }
                return part;
              }),
            },
          };
        });
        return transformed;
      },
    };

    // Sub-agent streams raw text, but has an output processor that modifies it
    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: RAW_SUB_AGENT_TEXT },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          },
        ]),
      }),
    });

    const subAgent = new Agent({
      id: 'processor-sub-agent',
      name: 'Processor Sub Agent',
      description: 'A sub-agent with an output processor.',
      instructions: 'You respond with text.',
      model: subAgentModel,
      outputProcessors: [textTransformProcessor],
    });

    // Supervisor delegates to sub-agent on first call, then returns final text on second call
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'supervisor-call-1',
                toolName: 'agent-processorSubAgent',
                input: JSON.stringify({ prompt: 'do something' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Supervisor final response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const supervisorAgent = new Agent({
      id: 'processor-supervisor',
      name: 'Processor Supervisor',
      instructions: 'You orchestrate sub-agents.',
      model: supervisorModel,
      agents: { processorSubAgent: subAgent },
    });

    new Mastra({
      agents: { processorSupervisor: supervisorAgent },
      storage: mockStorage,
    });

    const stream = await supervisorAgent.stream('Test prompt', { maxSteps: 5 });

    // Collect tool-result chunks to verify the sub-agent result text seen by the supervisor
    let subAgentResultText = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-result') {
        const payload = chunk.payload;
        if (payload.toolName === 'agent-processorSubAgent' && payload.result?.text) {
          subAgentResultText = payload.result.text;
        }
      }
    }

    // The supervisor should see the processed text, not the raw LLM output
    expect(subAgentResultText).toBe(PROCESSED_SUB_AGENT_TEXT);
    expect(subAgentResultText).not.toBe(RAW_SUB_AGENT_TEXT);
  });
});

describe('Supervisor Pattern - Sub-agent should not receive parent tool call references for unknown tools', () => {
  it('should not pass tool_call or tool_result content parts from the parent to the sub-agent model', async () => {
    // Scenario: Supervisor delegates to a sub-agent that has its own tools.
    // On a second generate() call, the supervisor's memory includes the previous
    // delegation's tool_call/tool_result pairs. When the supervisor delegates again,
    // the sub-agent's model receives these messages which reference tools the
    // sub-agent does NOT have. This causes providers (especially via custom gateways)
    // to reject or mishandle the request.
    //
    // This test captures the prompts sent to the sub-agent's model and verifies
    // that on the second delegation, the sub-agent does NOT receive any tool_call
    // or tool_result content parts from the parent conversation.

    const subAgentReceivedPrompts: any[][] = [];
    const subAgentReceivedTools: any[][] = [];

    // Sub-agent model: captures prompts and tools
    let subCallCount = 0;
    const subAgentModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt, tools }) => {
        subCallCount++;
        subAgentReceivedPrompts.push(prompt as any[]);
        subAgentReceivedTools.push(tools as any[]);

        if (subCallCount === 1) {
          // First call: use the createRecord tool
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'create-call-1',
                toolName: 'createRecord',
                input: JSON.stringify({ name: 'Test Record' }),
              },
            ],
            warnings: [],
          };
        }

        // Subsequent calls: respond with text
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: subCallCount === 2 ? 'Created record rec_001' : 'Updated record rec_001',
          content: [
            {
              type: 'text' as const,
              text: subCallCount === 2 ? 'Created record rec_001' : 'Updated record rec_001',
            },
          ],
          warnings: [],
        };
      },
    });

    const createRecordTool = createTool({
      id: 'create-record',
      description: 'Creates a new record',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => ({ id: 'rec_001', name, status: 'created' }),
    });

    const subAgent = new Agent({
      id: 'data-agent',
      name: 'data-agent',
      description: 'Manages data records',
      instructions: 'You manage data records using your tools.',
      model: subAgentModel,
      tools: { createRecord: createRecordTool },
    });

    // Supervisor model: delegates to data-agent on each call
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV2({
      doGenerate: async () => {
        supervisorCallCount++;
        if (supervisorCallCount % 2 === 1) {
          const prompt = supervisorCallCount === 1 ? 'Create a record named Test Record' : 'Create another record';
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: `supervisor-call-${supervisorCallCount}`,
                toolName: 'agent-dataAgent',
                input: JSON.stringify({ prompt }),
              },
            ],
            warnings: [],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: 'Done',
          content: [{ type: 'text' as const, text: 'Done' }],
          warnings: [],
        };
      },
    });

    const sharedMemory = new MockMemory();

    const supervisor = new Agent({
      id: 'supervisor-tool-leak',
      name: 'supervisor-tool-leak',
      instructions: 'You orchestrate data management via sub-agents.',
      model: supervisorModel,
      agents: { dataAgent: subAgent },
      memory: sharedMemory,
    });

    const threadId = 'tool-leak-thread';
    const resourceId = 'tool-leak-user';

    // First generate: supervisor delegates to sub-agent
    await supervisor.generate('Create a record named Test Record', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
    });

    // Reset sub-agent tracking for second call
    const firstCallPromptCount = subAgentReceivedPrompts.length;

    // Second generate: supervisor delegates to sub-agent again
    await supervisor.generate('Create another record', {
      maxSteps: 5,
      memory: { thread: threadId, resource: resourceId },
    });

    // Verify the sub-agent was called on the second delegation
    expect(subAgentReceivedPrompts.length).toBeGreaterThan(firstCallPromptCount);

    // Check the prompts received by the sub-agent on the SECOND delegation.
    // The sub-agent's model should NOT receive any tool_call or tool_result
    // content parts from the parent conversation, because the sub-agent
    // doesn't have those tools and it would confuse the model.
    for (let i = firstCallPromptCount; i < subAgentReceivedPrompts.length; i++) {
      const prompt = subAgentReceivedPrompts[i]!;
      for (const message of prompt) {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const parentToolCalls = message.content.filter((part: any) => part.type === 'tool-call');
          // The only tool-calls allowed are those for the sub-agent's OWN tools (e.g. createRecord)
          for (const tc of parentToolCalls) {
            expect(tc.toolName).toBe('createRecord');
          }
        }
        // No tool role messages from the parent should be forwarded
        if (message.role === 'tool') {
          // tool messages in the sub-agent prompt should only be for the sub-agent's own tool calls
          if (Array.isArray(message.content)) {
            for (const part of message.content) {
              if (part.type === 'tool-result') {
                // Must not be a parent tool call ID (supervisor-call-*)
                expect(part.toolCallId).not.toMatch(/^supervisor-call-/);
              }
            }
          }
        }
      }
    }
  });
});
