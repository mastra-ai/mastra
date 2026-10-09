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

  it('invokes onDelegationStart when the supervisor delegates to a sub-agent', async () => {
    const onDelegationStart = vi.fn(() => ({ proceed: true as const }));

    const subAgent = makeSubAgent('researchAgent', 'Dolphins are marine mammals.');

    const supervisor = new Agent({
      id: 'supervisor-delegation-start',
      name: 'supervisor-delegation-start',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('researchAgent', 'research dolphins') as LanguageModelV2,
      agents: { researchAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Research dolphins', {
      maxSteps: 3,
      delegation: { onDelegationStart },
    });

    // Drain the stream so the full agentic loop completes
    for await (const _chunk of fullStream) {
      // no-op
    }

    expect(onDelegationStart).toHaveBeenCalledTimes(1);
    expect(onDelegationStart).toHaveBeenCalledWith(
      expect.objectContaining({
        primitiveType: 'agent',
        prompt: 'research dolphins',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Research dolphins' })]),
          }),
        ]),
      }),
    );

    cleanup();
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

  it.each(['plain', 'durable'] as const)('forwards transient request-processor messages (%s)', async engine => {
    const subAgent = makeSubAgent('worker', 'Finished');
    const streamSpy = vi.spyOn(subAgent, 'stream');
    const supervisor = new Agent({
      id: `supervisor-processor-${engine}`,
      name: `supervisor-processor-${engine}`,
      instructions: 'Delegate to worker.',
      model: makeSupervisorModel('worker', 'go'),
      agents: { worker: subAgent },
      inputProcessors: [
        {
          id: 'transient-context',
          processLLMRequest: ({ prompt }) => ({
            prompt: [...prompt, { role: 'user', content: [{ type: 'text', text: 'Transient parent context' }] }],
          }),
        },
      ],
    });
    const messageFilter = vi.fn(({ messages }: { messages: ModelMessage[] }) => messages);
    const agent = engine === 'durable' ? createDurableAgent({ agent: supervisor, pubsub }) : supervisor;
    const output = await agent.stream('Original user message', { maxSteps: 3, delegation: { messageFilter } });
    for await (const _chunk of output.fullStream) {
      // no-op
    }
    const expectedMessages = expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Transient parent context' })]),
      }),
      expect.objectContaining({
        role: 'user',
        content: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Original user message' })]),
      }),
    ]);
    expect(messageFilter).toHaveBeenCalledWith(expect.objectContaining({ messages: expectedMessages }));
    expect(streamSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ context: expectedMessages }));
    if ('cleanup' in output && typeof output.cleanup === 'function') output.cleanup();
  });

  it('excludes observational-memory continuation hints from delegated context', async () => {
    const subAgent = makeSubAgent('worker', 'Finished');
    const messageFilter = vi.fn(({ messages }: { messages: ModelMessage[] }) => messages);
    const supervisor = new Agent({
      id: 'supervisor-observations',
      name: 'supervisor-observations',
      instructions: 'Delegate to worker.',
      model: makeSupervisorModel('worker', 'go'),
      agents: { worker: subAgent },
      inputProcessors: [
        {
          id: 'observational-memory',
          processInput: ({ messages, systemMessages }) => ({
            messages: [
              ...messages,
              {
                id: 'om-continuation',
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: 'Synthetic continuation hint' }] },
                createdAt: new Date(),
              },
            ],
            systemMessages: [...systemMessages, { role: 'system', content: 'Observed parent history' }],
          }),
        },
      ],
    });
    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });
    const output = await durableAgent.stream('Real user request', { maxSteps: 3, delegation: { messageFilter } });
    for await (const _chunk of output.fullStream) {
      // no-op
    }
    const messages = messageFilter.mock.calls[0]?.[0].messages;
    expect(messages).toBeDefined();
    expect(JSON.stringify(messages)).toContain('Observed parent history');
    expect(JSON.stringify(messages)).toContain('Real user request');
    expect(JSON.stringify(messages)).not.toContain('Synthetic continuation hint');
    output.cleanup();
  });

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

  it('invokes onDelegationComplete with the sub-agent result', async () => {
    const onDelegationComplete = vi.fn(() => undefined);

    const subAgent = makeSubAgent('writerAgent', 'Here is the final report.');

    const supervisor = new Agent({
      id: 'supervisor-delegation-complete',
      name: 'supervisor-delegation-complete',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('writerAgent', 'write a report') as LanguageModelV2,
      agents: { writerAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Write a report', {
      maxSteps: 3,
      delegation: { onDelegationComplete },
    });

    for await (const _chunk of fullStream) {
      // no-op
    }

    expect(onDelegationComplete).toHaveBeenCalledTimes(1);
    expect(onDelegationComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        primitiveType: 'agent',
        result: expect.objectContaining({ text: 'Here is the final report.' }),
      }),
    );

    cleanup();
  });

  it('derives sub-agent thread/resource identity from the caller (issue #23903)', async () => {
    const subAgent = makeSubAgent('researchAgent', 'Dolphins are marine mammals.');
    const streamSpy = vi.spyOn(subAgent, 'stream');

    const supervisor = new Agent({
      id: 'supervisor-delegation-identity',
      name: 'supervisor-delegation-identity',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('researchAgent', 'research dolphins') as LanguageModelV2,
      agents: { researchAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Research dolphins', {
      maxSteps: 3,
      memory: { thread: 'thread-1', resource: 'user-1' },
    });

    for await (const _chunk of fullStream) {
      // no-op
    }

    // The delegation wrapper derives sub-agent identity from the args stamped by
    // the tool-call step (`${callerResourceId}-${agentName}`). Without stamping,
    // it falls back to a parent-derived constant shared by every caller.
    expect(streamSpy).toHaveBeenCalledTimes(1);
    const subAgentCallArgs = streamSpy.mock.calls[0] as unknown[];
    const subAgentOptions = subAgentCallArgs?.[1] as { memory?: { thread?: unknown; resource?: unknown } } | undefined;
    expect(subAgentOptions?.memory?.resource).toBe('user-1-researchAgent');
    expect(subAgentOptions?.memory?.thread).toMatch(/^thread-1-/);

    cleanup();
  });

  it('applies onDelegationStart context mutations to the delegated run', async () => {
    let subAgentSawSpecialty: unknown;

    const subAgent = new Agent({
      id: 'specialistAgent',
      name: 'specialistAgent',
      description: 'Runtime-configured sub-agent',
      instructions: ({ requestContext }) => {
        subAgentSawSpecialty = requestContext.get('specialty');
        return 'You are a helpful sub-agent.';
      },
      model: makeSubAgentModel('Task done.') as LanguageModelV2,
    });

    const supervisor = new Agent({
      id: 'supervisor-delegation-context',
      name: 'supervisor-delegation-context',
      instructions: 'You orchestrate sub-agents.',
      model: makeSupervisorModel('specialistAgent', 'do specialized work') as LanguageModelV2,
      agents: { specialistAgent: subAgent },
    });

    const durableAgent = createDurableAgent({ agent: supervisor, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Do the work', {
      maxSteps: 3,
      delegation: {
        onDelegationStart: context => {
          context.requestContext.set('specialty', context.primitiveId);
        },
      },
    });

    for await (const _chunk of fullStream) {
      // no-op
    }

    expect(subAgentSawSpecialty).toBe('specialistAgent');

    cleanup();
  });
});
