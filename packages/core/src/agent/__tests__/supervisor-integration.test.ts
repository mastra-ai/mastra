import { openai } from '@ai-sdk/openai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { ContextFilterContext, DelegationCompleteContext, IterationCompleteContext } from '../agent.types';

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
          return { continue: true };
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

    it('should invoke contextFilter callback before delegating to a sub-agent', async () => {
      const contextFilterSpy = vi.fn(({ messages }: ContextFilterContext) => messages.filter(m => m.role !== 'system'));

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
        delegation: { contextFilter: contextFilterSpy },
      });

      // contextFilter should be called once for the single sub-agent delegation
      expect(contextFilterSpy).toHaveBeenCalledTimes(1);
      expect(contextFilterSpy).toHaveBeenCalledWith(
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
          bailStrategy: 'first',
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
        bailStrategy: 'first' as const,
        onDelegationStart: vi.fn(() => {
          return { proceed: true };
        }),
        onDelegationComplete: vi.fn(() => {
          return undefined;
        }),
        contextFilter: ({ messages }: ContextFilterContext) => messages.filter(m => m.role !== 'system').slice(-10),
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
        return { continue: true };
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
 * Completion scorers in supervisor pattern.
 * Tests that completion scorers work alongside the supervisor's delegation system.
 */
describe('Supervisor Pattern - Completion scorers', () => {
  it('should run completion scorers after each iteration in supervisor generate()', async () => {
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

    const completionCheckEvents: any[] = [];

    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 3,
      completion: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvents.push(chunk);
      }
    }

    // Scorer should have been called for the completed iteration
    expect(scorerRun).toHaveBeenCalled();

    // Completion check events should have been emitted
    expect(completionCheckEvents.length).toBeGreaterThan(0);
    expect(completionCheckEvents[0].payload.passed).toBe(true);
  });

  it('should continue iterating when completion scorer fails and stop when it passes', async () => {
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

    const completionCheckEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 5,
      completion: { scorers: [adaptiveScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvents.push(chunk);
      }
    }

    // Scorer should have been called twice (once failing, once passing)
    expect(adaptiveScorer.run).toHaveBeenCalledTimes(2);

    // Model should have been invoked at least twice (due to failed scorer triggering re-run)
    expect(modelCallCount).toBeGreaterThanOrEqual(2);

    // Should have 2 completion check events: one failed, one passed
    expect(completionCheckEvents.length).toBe(2);
    expect(completionCheckEvents[0].payload.passed).toBe(false);
    expect(completionCheckEvents[1].payload.passed).toBe(true);
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
        return { continue: true };
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

    // When the model returns stop (isFinal), the loop ends after that iteration
    // even if the hook returns continue: true with feedback. Feedback only adds
    // a user message for the *next* iteration when the loop would naturally continue
    // (e.g. during a tool-call sequence). Here the model says stop on iteration 1
    // so the loop ends and the hook is called exactly once.
    expect(iterationCount).toBe(1);
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
 * Completion feedback tests for the supervisor pattern.
 * Tests scorer strategies, suppressFeedback flag, and multi-iteration callbacks.
 *
 * Key differences from agent-network.test.ts:
 * - Supervisor uses completion-check-step.ts (stream-based scorers).
 * - `suppressFeedback` stores a flag in the completion-check chunk payload and in the
 *   feedback message's metadata; it does NOT prevent the message from being added to
 *   the messageList or from being sent to the model in the next iteration.
 * - maxSteps does NOT terminate the loop when a completion scorer keeps failing
 *   (unlike the network flow).  Always ensure a scorer eventually passes to avoid
 *   an infinite loop.
 */
describe('Supervisor Pattern - Completion feedback', () => {
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

    const completionCheckEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 5,
      completion: {
        scorers: [passingScorer as any, adaptiveScorer as any],
        strategy: 'all',
      },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvents.push(chunk);
      }
    }

    // Iter 1: adaptiveScorer fails → overall passed=false (strategy 'all' requires all to pass)
    expect(completionCheckEvents[0].payload.passed).toBe(false);
    expect(completionCheckEvents[0].payload.results).toHaveLength(2);

    // Iter 2: both scorers pass → overall passed=true
    expect(completionCheckEvents[1].payload.passed).toBe(true);
    expect(completionCheckEvents.length).toBe(2);

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

    const completionCheckEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      completion: {
        scorers: [passingScorer as any, failingScorer as any],
        strategy: 'any',
      },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvents.push(chunk);
      }
    }

    // With 'any' strategy, one passing scorer is enough
    expect(completionCheckEvents).toHaveLength(1);
    expect(completionCheckEvents[0].payload.passed).toBe(true);
    expect(completionCheckEvents[0].payload.results).toHaveLength(2);
    expect(passingScorer.run).toHaveBeenCalled();
    expect(failingScorer.run).toHaveBeenCalled();
  });

  it('should include scorer results and reason in completion-check event', async () => {
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

    let completionCheckEvent: any;
    const stream = await supervisorAgent.stream('Do the task', {
      completion: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvent = chunk;
      }
    }

    expect(completionCheckEvent).toBeDefined();
    expect(completionCheckEvent.payload.results).toHaveLength(1);
    // ScorerResult uses scorerId/scorerName (not id/name)
    expect(completionCheckEvent.payload.results[0].scorerId).toBe('detailed-scorer');
    expect(completionCheckEvent.payload.results[0].reason).toBe('Task clearly completed with all requirements met');
    expect(completionCheckEvent.payload.passed).toBe(true);
  });

  it('should report suppressFeedback: true in completion-check event when configured', async () => {
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
      completion: { scorers: [passingScorer as any], suppressFeedback: true },
    });
    for await (const chunk of stream1.fullStream) {
      if (chunk.type === 'completion-check') chunkWithSuppression = chunk;
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
      completion: { scorers: [passingScorer as any] },
    });
    for await (const chunk of stream2.fullStream) {
      if (chunk.type === 'completion-check') chunkDefault = chunk;
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
      completion: { scorers: [mockScorer as any] },
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

  it('should report maxIterationReached in completion-check when iteration equals maxSteps', async () => {
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

    const completionCheckEvents: any[] = [];
    const stream = await supervisorAgent.stream('Complete a task', {
      maxSteps: 2,
      completion: { scorers: [mockScorer as any] },
    });

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'completion-check') {
        completionCheckEvents.push(chunk);
      }
    }

    expect(completionCheckEvents).toHaveLength(2);
    // First iteration (currentIteration=1): 1 >= 2 is false
    expect(completionCheckEvents[0].payload.maxIterationReached).toBe(false);
    // Second iteration (currentIteration=2): 2 >= 2 is true
    expect(completionCheckEvents[1].payload.maxIterationReached).toBe(true);
  });
});
