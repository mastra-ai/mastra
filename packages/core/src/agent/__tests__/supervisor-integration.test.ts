import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Delegate task', {
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

      const mastra = new Mastra({
        agents: {
          'test-agent': agent,
        },
        storage: new InMemoryStore(),
      });

      const testAgent = mastra.getAgent('test-agent');

      await testAgent.generate('Use tool then respond', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'research-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Research dolphins', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'writer-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Write a report', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'blocked-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Do something', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'prompt-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Do something', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'filter-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Task with context', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'ordered-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Ordered task', {
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

      const mastra = new Mastra({
        agents: { supervisor: supervisorAgent, 'bail-agent': subAgent },
        storage: new InMemoryStore(),
      });

      await mastra.getAgent('supervisor').generate('Two-task job', {
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

  describe('Bail mechanism integration', () => {
    it('should handle bail flag in delegation complete hook', async () => {
      let bailCalled = false;

      const criticalTool = createTool({
        id: 'critical-tool',
        description: 'A critical tool',
        inputSchema: z.object({
          data: z.string(),
        }),
        execute: async () => {
          return { result: 'CRITICAL_SUCCESS' };
        },
      });

      const agent = new Agent({
        id: 'agent-with-bail',
        name: 'Agent with Bail',
        instructions: 'You use critical tools',
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            text: '',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'critical-tool',
                args: { data: 'important' },
              },
            ],
            warnings: [],
          }),
          doStream: async () => ({
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call-start',
                id: 'call-1',
                toolCallId: 'call-1',
                toolName: 'critical-tool',
              },
              {
                type: 'tool-call-args-delta',
                id: 'call-1',
                toolCallId: 'call-1',
                toolName: 'critical-tool',
                argsDelta: '{"data":"important"}',
              },
              {
                type: 'tool-call-end',
                id: 'call-1',
                toolCallId: 'call-1',
                toolName: 'critical-tool',
                args: { data: 'important' },
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          }),
        }),
        tools: {
          criticalTool,
        },
        memory: new MockMemory(),
      });

      const mastra = new Mastra({
        agents: {
          'agent-with-bail': agent,
        },
        storage: new InMemoryStore(),
      });

      const testAgent = mastra.getAgent('agent-with-bail');

      // Note: delegation hooks are specifically for sub-agent/workflow tools
      // Regular tools don't trigger delegation hooks
      // This test verifies the hook structure exists and can be configured
      await testAgent.generate('Use critical tool', {
        maxSteps: 2,
        delegation: {
          bailStrategy: 'first',
          onDelegationComplete: (ctx: DelegationCompleteContext) => {
            if (ctx.result?.result === 'CRITICAL_SUCCESS') {
              ctx.bail();
              bailCalled = true;
              return { stopProcessing: true };
            }
          },
        },
      });

      // Bail hook is configured but only triggers for agent/workflow tools
      expect(bailCalled).toBe(false); // Regular tools don't trigger delegation hooks
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

      const mastra = new Mastra({
        agents: {
          'configured-agent': agent,
        },
        storage: new InMemoryStore(),
      });

      const testAgent = mastra.getAgent('configured-agent');

      // Verify delegation config is accepted without errors
      await testAgent.generate('Test prompt', {
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

      const mastra = new Mastra({
        agents: {
          'iteration-agent': agent,
        },
        storage: new InMemoryStore(),
      });

      const testAgent = mastra.getAgent('iteration-agent');

      await testAgent.generate('Test prompt', {
        maxSteps: 1,
        onIterationComplete: iterationHook,
      });

      // Hook should be called once for the iteration that completed with 'stop'
      expect(iterationHook).toHaveBeenCalledTimes(1);
      const hookCall = iterationHook.mock.calls[0][0];
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
