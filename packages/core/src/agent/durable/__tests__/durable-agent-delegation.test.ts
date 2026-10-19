/**
 * DurableAgent Delegation Tests
 *
 * Verifies that per-call `delegation` hooks (`onDelegationStart`,
 * `onDelegationComplete`) flow through `DurableAgent.stream()` /
 * `prepare()` into the sub-agent CoreTool wrappers stored on the
 * in-process run registry.
 *
 * The closures live only on the registry: `convertTools` bakes them
 * into the sub-agent tool at prepare time. Cross-process resume on a
 * fresh worker degrades to default delegation behaviour.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { ModelMessage } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { STEP_MODEL_MESSAGES_KEY } from '../../../loop/run-scope-keys';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import type { ToolExecutionContext } from '../../../tools';
import { createStep, createWorkflow } from '../../../workflows';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { createDurableToolCallStep } from '../workflows/steps/tool-call';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Sub-agent: streams a single text response */
function makeSubAgentModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-0', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'sub-text' },
        { type: 'text-delta', id: 'sub-text', delta: text },
        { type: 'text-end', id: 'sub-text' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Supervisor: first turn calls `agent-{key}`; second turn stops.
 */
function makeSupervisorModel(agentKey: string, prompt: string, toolName = `agent-${agentKey}`) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'sup-call-1',
              toolName,
              input: JSON.stringify({ prompt }),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sup-1', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sup-text' },
          { type: 'text-delta', id: 'sup-text', delta: 'Done' },
          { type: 'text-end', id: 'sup-text' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function makeSubAgent(id: string, text: string, model: LanguageModelV2 = makeSubAgentModel(text)) {
  return new Agent({
    id,
    name: id,
    description: `Sub-agent ${id}`,
    instructions: 'You are a helpful sub-agent.',
    model,
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('DurableAgent delegation hooks', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it.each(['step-output', 'workflow-state'])(
    'restores the LLM conversation from %s on a cold foreach tool worker',
    async storage => {
      const runId = `cold-delegation-context-${storage}`;
      const subAgentModel = makeSubAgentModel('Finished');
      const modelSpy = vi.spyOn(subAgentModel, 'doStream');
      const supervisor = new Agent({
        id: 'cold-supervisor',
        name: 'cold-supervisor',
        instructions: 'Delegate to worker.',
        model: makeSupervisorModel('worker', 'go'),
        agents: { worker: makeSubAgent('worker', 'Finished', subAgentModel) },
      });
      const messageList = new MessageList();
      messageList.add({ role: 'user', content: 'Original user request' }, 'input');
      messageList.add({ role: 'user', content: 'Processor-added parent history' }, 'input');
      messageList.add(
        {
          id: 'om-continuation',
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'Processor-added parent history' }] },
        },
        'input',
      );
      const workflow = createWorkflow({
        id: 'cold-delegation-workflow',
        inputSchema: z.any(),
        outputSchema: z.any(),
      })
        .then(
          createStep({
            id: DurableStepIds.LLM_EXECUTION,
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ setState }) => {
              if (storage === 'workflow-state') {
                await setState({ messageListState: messageList.serialize() });
                return {};
              }
              return { messageListState: messageList.serialize() };
            },
          }),
        )
        .map(async () => [{ toolCallId: 'cold-call', toolName: 'agent-worker', args: { prompt: 'go' } }])
        .foreach(createDurableToolCallStep())
        .commit();
      const mastra = new Mastra({ agents: { supervisor }, workflows: { workflow } });
      expect(globalRunRegistry.has(runId)).toBe(false);
      const run = await mastra.getWorkflow('workflow').createRun();
      const result = await run.start({ inputData: { runId, agentId: supervisor.id, options: {}, state: {} } });
      expect(result.status).toBe('success');
      expect(modelSpy).toHaveBeenCalledTimes(1);
      const prompt = JSON.stringify(modelSpy.mock.calls[0]?.[0].prompt);
      expect(prompt).toContain('Original user request');
      expect(prompt.split('Processor-added parent history')).toHaveLength(2);
    },
  );

  it('converts cold-worker history in prompt mode before invoking the tool', async () => {
    const execute = vi.fn(async (_input: { prompt: string }, _context: ToolExecutionContext) => 'Finished');
    const tool = createTool({
      id: 'agent-history',
      description: 'Inspect forwarded history.',
      inputSchema: z.object({ prompt: z.string() }),
      execute,
    });
    const messageList = new MessageList();
    messageList.add({ role: 'user', content: 'Original request' }, 'input');
    messageList.add(
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Preserve this assistant text' },
          { type: 'tool-call', toolCallId: 'orphan-call', toolName: 'agent-history', args: { prompt: 'go' } },
        ],
      },
      'response',
    );
    const workflow = createWorkflow({ id: 'cold-prompt-workflow', inputSchema: z.any(), outputSchema: z.any() })
      .then(
        createStep({
          id: DurableStepIds.LLM_EXECUTION,
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async () => ({ messageListState: messageList.serialize() }),
        }),
      )
      .map(async () => [{ toolCallId: 'cold-call', toolName: tool.id, args: { prompt: 'go' } }])
      .foreach(createDurableToolCallStep())
      .commit();
    const mastra = new Mastra({ tools: { [tool.id]: tool }, workflows: { workflow } });
    const runId = 'cold-prompt-context';
    expect(globalRunRegistry.has(runId)).toBe(false);
    const run = await mastra.getWorkflow('workflow').createRun();
    const result = await run.start({ inputData: { runId, agentId: 'missing-supervisor', options: {}, state: {} } });
    expect(result.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(1);
    const messages = execute.mock.calls[0]?.[1]?.agent?.messages;
    expect(JSON.stringify(messages)).toContain('Preserve this assistant text');
    expect(JSON.stringify(messages)).not.toContain('orphan-call');
  });

  it.each(['intact', 'missing-key', 'missing-scope'] as const)(
    'forwards filtered parent conversation to the sub-agent (%s)',
    async scopeState => {
      const subAgentModel = makeSubAgentModel('Finished');
      const modelSpy = vi.spyOn(subAgentModel, 'doStream');
      const subAgent = makeSubAgent('worker', 'Finished', subAgentModel);
      const streamSpy = vi.spyOn(subAgent, 'stream');
      const model = makeSupervisorModel('worker', 'go');
      const runId = `delegation-context-${scopeState}`;
      let scopeCleared = false;
      if (scopeState !== 'intact') {
        const doStream = model.doStream.bind(model);
        vi.spyOn(model, 'doStream').mockImplementation(async options => {
          const result = await doStream(options);
          const entry = globalRunRegistry.get(runId);
          if (entry?.runScope?.has(STEP_MODEL_MESSAGES_KEY)) {
            if (scopeState === 'missing-key') entry.runScope.delete(STEP_MODEL_MESSAGES_KEY);
            else entry.runScope = undefined;
            scopeCleared = true;
          }
          return result;
        });
      }
      const supervisor = new Agent({
        id: 'supervisor-context',
        name: 'supervisor-context',
        instructions: 'Delegate to worker.',
        model,
        agents: { worker: subAgent },
      });
      const messageFilter = vi.fn(({ messages }: { messages: ModelMessage[] }) =>
        messages.filter(message => message.role === 'user'),
      );
      const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
      const { fullStream, cleanup } = await durableAgent.stream('Write a caption for the sunset photo', {
        runId,
        maxSteps: 3,
        delegation: { messageFilter },
      });
      for await (const _chunk of fullStream) {
        // no-op
      }
      expect(messageFilter).toHaveBeenCalledTimes(1);
      const expectedMessages = expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text', text: 'Write a caption for the sunset photo' }),
          ]),
        }),
      ]);
      expect(messageFilter).toHaveBeenCalledWith(expect.objectContaining({ messages: expectedMessages }));
      expect(streamSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ context: expectedMessages }));
      expect(streamSpy.mock.calls[0]?.[1]?.context?.every(message => message.role === 'user')).toBe(true);
      expect(modelSpy).toHaveBeenCalledWith(expect.objectContaining({ prompt: expectedMessages }));
      expect(scopeCleared).toBe(scopeState !== 'intact');
      cleanup();
    },
  );

  it.each([false, true].flatMap(withImage => ['shallow', 'deep', 'rewrite'].map(copy => ({ withImage, copy }))))(
    'retains matching user messages after $copy copying (image: $withImage)',
    async ({ withImage, copy }) => {
      const continuationText = 'Matching continuation text';
      const requestPrompts: ModelMessage[][] = [];
      const model = makeSupervisorModel('worker', 'go');
      const modelSpy = vi.spyOn(model, 'doStream');
      const messageFilter = vi.fn(({ messages }: { messages: ModelMessage[] }) => messages);
      const supervisor = new Agent({
        id: 'supervisor-matching-continuation',
        name: 'supervisor-matching-continuation',
        instructions: 'Delegate to worker.',
        model,
        agents: { worker: makeSubAgent('worker', 'Finished') },
        inputProcessors: [
          {
            id: 'observational-memory',
            processInput: ({ messages, systemMessages }) => ({
              systemMessages,
              messages: [
                ...messages,
                {
                  id: 'om-continuation',
                  role: 'user',
                  content: { format: 2, parts: [{ type: 'text', text: continuationText }] },
                  createdAt: new Date(),
                },
              ],
            }),
            processLLMRequest: ({ prompt }) => {
              requestPrompts.push(prompt);
              if (copy === 'shallow') return { prompt: prompt.map(message => ({ ...message })) };
              const cloned = structuredClone(prompt);
              if (copy === 'rewrite') {
                cloned.reverse();
                const continuation = cloned.find(
                  message => message.providerOptions?.mastra?.messageId === 'om-continuation',
                );
                if (continuation) continuation.content = [{ type: 'text', text: 'Rewritten synthetic continuation' }];
              }
              return { prompt: cloned };
            },
          },
        ],
      });
      const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
      const userMessage: ModelMessage = {
        role: 'user',
        content: [
          { type: 'text', text: continuationText },
          ...(withImage
            ? [
                {
                  type: 'image' as const,
                  image:
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
                  mediaType: 'image/png',
                },
              ]
            : []),
        ],
      };
      const output = await durableAgent.stream([userMessage], { maxSteps: 3, delegation: { messageFilter } });
      for await (const _chunk of output.fullStream) {
        // no-op
      }
      expect(messageFilter).toHaveBeenCalledTimes(1);
      expect(requestPrompts[0]?.filter(message => message.role === 'user')).toHaveLength(2);
      const modelPrompt = modelSpy.mock.calls[0]?.[0].prompt;
      expect(modelPrompt?.filter(message => message.role === 'user')).toHaveLength(2);
      expect(modelPrompt?.some(message => 'id' in message)).toBe(false);
      expect(modelPrompt?.some(message => message.providerOptions?.mastra?.messageId === 'om-continuation')).toBe(true);
      if (copy === 'rewrite') expect(JSON.stringify(modelPrompt)).toContain('Rewritten synthetic continuation');
      const userMessages = messageFilter.mock.calls[0]?.[0].messages.filter(message => message.role === 'user');
      expect(userMessages).toHaveLength(1);
      expect(userMessages?.[0]).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([expect.objectContaining({ type: 'text', text: continuationText })]),
        }),
      );
      if (withImage) {
        expect(userMessages?.[0]?.content).toEqual(
          expect.arrayContaining([expect.objectContaining({ mediaType: 'image/png', data: expect.any(String) })]),
        );
      }
      output.cleanup();
    },
  );

  it('gives ordinary tools input-only messages, not transient model context', async () => {
    const execute = vi.fn(async (_input: { prompt: string }, _context: ToolExecutionContext) => 'Finished');
    const supervisor = new Agent({
      id: 'ordinary-tool-context',
      name: 'ordinary-tool-context',
      instructions: 'Use the lookup tool.',
      model: makeSupervisorModel('unused', 'go', 'lookup'),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up data',
          inputSchema: z.object({ prompt: z.string() }),
          execute,
        }),
      },
      inputProcessors: [
        {
          id: 'transient-context',
          processLLMRequest: ({ prompt }) => ({
            prompt: [...prompt, { role: 'user', content: [{ type: 'text', text: 'Transient model context' }] }],
          }),
        },
      ],
    });
    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
    const output = await durableAgent.stream('Original user message', { maxSteps: 3 });
    for await (const _chunk of output.fullStream) {
      // no-op
    }
    expect(execute).toHaveBeenCalledTimes(1);
    const messages = execute.mock.calls[0]?.[1]?.agent?.messages;
    expect(JSON.stringify(messages)).toContain('Original user message');
    expect(JSON.stringify(messages)).not.toContain('Transient model context');
    output.cleanup();
  });
});
