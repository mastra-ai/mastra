/**
 * When a sub-agent's model call fails (e.g. invalid API key), the parent must
 * receive a generic error tool result — not an empty successful result.
 * The original cause remains available to the completion hook, not the parent model.
 */
import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import type { DelegationCompleteContext } from '../agent.types';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const CAUSE = 'Incorrect API key provided: sk-bad';
const DEFAULT_ERROR = '[Agent:sup] - Failed agent tool execution for head';

function failingModel() {
  const fail = async () => {
    throw new APICallError({
      message: CAUSE,
      url: 'https://api.openai.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 401,
      responseBody: '{"error":{"message":"Incorrect API key provided"}}',
      isRetryable: false,
    });
  };
  return new MockLanguageModelV2({ doGenerate: fail, doStream: fail });
}

/** First call delegates to `agent-head`; second call answers "done". Records every prompt it receives. */
function supervisorModel(receivedPrompts: any[]) {
  let calls = 0;
  const toolCall = {
    toolCallId: 'sup-call-1',
    toolName: 'agent-head',
    input: '{"prompt":"Reply with exactly the word: ALIVE."}',
  };
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls++;
      receivedPrompts.push(JSON.parse(JSON.stringify(prompt)));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', ...toolCall, providerExecuted: false },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
    doGenerate: async ({ prompt }) => {
      calls++;
      receivedPrompts.push(JSON.parse(JSON.stringify(prompt)));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: calls === 1 ? 'tool-calls' : 'stop',
        usage,
        content: calls === 1 ? [{ type: 'tool-call', ...toolCall }] : [{ type: 'text', text: 'done' }],
      };
    },
  });
}

function setup(model = failingModel(), memory?: MockMemory, backgroundRetries?: number) {
  const receivedPrompts: any[] = [];
  const head = new Agent({ id: 'head', name: 'head', instructions: 'x', model, memory });
  const supervisor = new Agent({
    id: 'sup',
    name: 'sup',
    instructions: 'delegate',
    model: supervisorModel(receivedPrompts),
    agents: { head },
    memory,
    ...(backgroundRetries === undefined
      ? {}
      : {
          backgroundTasks: { tools: { head: { enabled: true } } },
        }),
  });
  const mastra = new Mastra({
    agents: { supervisor, head },
    logger: false,
    storage: new InMemoryStore(),
    ...(backgroundRetries === undefined
      ? {}
      : {
          backgroundTasks: { enabled: true, defaultRetries: { maxRetries: backgroundRetries, retryDelayMs: 1 } },
        }),
  });
  return { supervisor, receivedPrompts, mastra };
}

function toolResultSeenByModel(receivedPrompts: any[]) {
  const toolMsg = receivedPrompts[1]?.find((m: any) => m.role === 'tool');
  return toolMsg?.content?.find((p: any) => p.type === 'tool-result')?.output;
}

describe('sub-agent error propagation to parent', () => {
  it('stream: reports a generic failure to the parent while preserving the cause for diagnostics', async () => {
    const { supervisor, receivedPrompts } = setup();
    let hookCtx: any;

    const stream = await supervisor.stream('go', {
      delegation: {
        onDelegationComplete: ctx => {
          hookCtx = ctx;
        },
      },
    });
    const chunks: any[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);

    // The delegation must not produce an empty successful tool-result.
    expect(chunks.find(c => c.type === 'tool-result')).toBeUndefined();
    const toolErrorChunk = chunks.find(c => c.type === 'tool-error');
    expect(toolErrorChunk).toBeDefined();
    const errorText = JSON.stringify(toolErrorChunk.payload.error);
    expect(errorText).toContain('Failed agent tool execution for head');
    expect(errorText).toContain(CAUSE);

    const output = toolResultSeenByModel(receivedPrompts);
    expect(output.type).toBe('error-text');
    expect(output.value).toBe(DEFAULT_ERROR);
    expect(JSON.stringify(receivedPrompts)).not.toContain(CAUSE);

    expect(hookCtx.success).toBe(false);
    expect(hookCtx.error?.message).toBe(CAUSE);
  });

  it.each(['Replacement from hook', ''])('keeps failure-hook replacement text %j after reload', async resultText => {
    const memory = new MockMemory();
    const { supervisor, receivedPrompts } = setup(failingModel(), memory);
    const onDelegationComplete = vi.fn((_ctx: DelegationCompleteContext) => ({ resultText }));
    const stream = await supervisor.stream('go', {
      memory: { thread: 'parent-thread', resource: 'parent-resource' },
      delegation: { onDelegationComplete },
    });
    const chunks = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);
    expect(onDelegationComplete).toHaveBeenCalledTimes(1);
    expect(onDelegationComplete.mock.calls[0]![0].success).toBe(false);
    expect(onDelegationComplete.mock.calls[0]![0].error?.message).toBe(CAUSE);
    expect(toolResultSeenByModel(receivedPrompts)).toEqual({ type: 'error-text', value: resultText });
    expect(JSON.stringify(chunks.find(chunk => chunk.type === 'tool-error'))).toContain(CAUSE);
    const stored = await memory.recall({ threadId: 'parent-thread' });
    const reloaded = JSON.parse(JSON.stringify(stored.messages));
    expect(reloaded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                type: 'tool-invocation',
                toolInvocation: expect.objectContaining({
                  toolCallId: 'sup-call-1',
                  state: 'output-error',
                  errorText: resultText,
                }),
              }),
            ]),
          }),
        }),
      ]),
    );
  });

  it('keeps the original error when the failure hook throws, without invoking it again', async () => {
    const { supervisor, receivedPrompts } = setup();
    const onDelegationComplete = vi.fn((_ctx: DelegationCompleteContext) => {
      throw new Error('hook failure');
    });
    await (await supervisor.stream('go', { delegation: { onDelegationComplete } })).consumeStream();
    expect(onDelegationComplete).toHaveBeenCalledTimes(1);
    expect(onDelegationComplete.mock.calls[0]![0].error?.message).toBe(CAUSE);
    expect(toolResultSeenByModel(receivedPrompts).value).toBe(DEFAULT_ERROR);
    expect(JSON.stringify(receivedPrompts)).not.toContain(CAUSE);
    expect(toolResultSeenByModel(receivedPrompts).value).not.toContain('hook failure');
  });

  it.each(['stream', 'generate'] as const)(
    '%s: bail on a failed delegation prevents the next parent call',
    async mode => {
      const { supervisor, receivedPrompts } = setup();
      const onDelegationComplete = vi.fn((ctx: DelegationCompleteContext) => ctx.bail());
      const options = { delegation: { onDelegationComplete } };
      if (mode === 'stream') {
        await (await supervisor.stream('go', options)).consumeStream();
      } else {
        await supervisor.generate('go', options);
      }
      expect(onDelegationComplete).toHaveBeenCalledTimes(1);
      expect(onDelegationComplete.mock.calls[0]![0].success).toBe(false);
      expect(onDelegationComplete.mock.calls[0]![0].error?.message).toBe(CAUSE);
      expect(receivedPrompts).toHaveLength(1);
    },
  );

  it('preserves partial child messages in memory and the failure hook', async () => {
    const memory = new MockMemory();
    const saveMessages = vi.spyOn(memory, 'saveMessages');
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'partial' },
          { type: 'text-delta', id: 'partial', delta: 'Partial enrichment' },
          { type: 'text-end', id: 'partial' },
          { type: 'error', error: new Error(CAUSE) },
          { type: 'finish', finishReason: 'error', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      }),
    });
    const { supervisor, receivedPrompts } = setup(model, memory);
    const onDelegationComplete = vi.fn<(ctx: DelegationCompleteContext) => void>();
    await (
      await supervisor.stream('go', {
        memory: { thread: 'supervisor-thread', resource: 'supervisor-resource' },
        delegation: { onDelegationComplete },
      })
    ).consumeStream();
    expect(onDelegationComplete).toHaveBeenCalledTimes(1);
    const context = onDelegationComplete.mock.calls[0]![0];
    expect(context.success).toBe(false);
    expect(context.error?.message).toBe(CAUSE);
    expect(context.result).toMatchObject({
      text: 'Partial enrichment',
      finishReason: 'error',
      subAgentToolResults: [],
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    });
    const transcript = context.messages;
    expect(transcript?.some(message => message.role === 'user')).toBe(true);
    expect(JSON.stringify(transcript)).toContain('Partial enrichment');
    expect(saveMessages).toHaveBeenCalledWith({ messages: transcript });
    const threadId = transcript?.find(message => message.role === 'assistant')?.threadId;
    expect(threadId).toBeDefined();
    const stored = await memory.recall({ threadId: threadId! });
    expect(JSON.stringify(stored.messages)).toContain('Partial enrichment');
    expect(context.result.subAgentThreadId).toBe(threadId);
    const parent = await memory.recall({ threadId: 'supervisor-thread' });
    const invocation = parent.messages
      .flatMap(message => message.content.parts)
      .find(part => part.type === 'tool-invocation');
    expect(invocation).toMatchObject({
      toolInvocation: {
        state: 'output-error',
        errorText: DEFAULT_ERROR,
        result: {
          subAgentThreadId: threadId,
          subAgentResourceId: context.result.subAgentResourceId,
        },
      },
    });
    expect(toolResultSeenByModel(receivedPrompts)).toEqual({ type: 'error-text', value: DEFAULT_ERROR });
    expect(JSON.stringify(receivedPrompts)).not.toContain('Partial enrichment');
  });

  it.each([0, 1])('respects %i configured background retries and invokes the hook per attempt', async maxRetries => {
    const attempt = vi.fn();
    const model = new MockLanguageModelV2({
      doStream: async () => {
        attempt();
        return {
          warnings: [],
          stream: convertArrayToReadableStream(
            attempt.mock.calls.length === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'error', error: new Error(CAUSE) },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 'retry' },
                  { type: 'text-delta', id: 'retry', delta: 'Recovered' },
                  { type: 'text-end', id: 'retry' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ],
          ),
        };
      },
    });
    const { supervisor, mastra } = setup(model, undefined, maxRetries);
    const onDelegationComplete = vi.fn<(ctx: DelegationCompleteContext) => void>();
    try {
      await (await supervisor.stream('go', { delegation: { onDelegationComplete } })).consumeStream();
      const listed = await mastra.backgroundTaskManager!.listTasks();
      expect(listed.tasks).toHaveLength(1);
      const task = await mastra.backgroundTaskManager!.waitForNextTask([listed.tasks[0]!.id], { timeoutMs: 5000 });
      expect(task.maxRetries).toBe(maxRetries);
      expect(task.status).toBe(maxRetries ? 'completed' : 'failed');
      expect(attempt).toHaveBeenCalledTimes(maxRetries + 1);
      expect(onDelegationComplete.mock.calls.map(([ctx]) => ctx.success)).toEqual(maxRetries ? [false, true] : [false]);
      expect(onDelegationComplete.mock.calls[0]![0].error?.message).toBe(CAUSE);
    } finally {
      await mastra.backgroundTaskManager?.shutdown();
      await mastra.stopWorkers();
    }
  });

  it('generate: keeps the underlying cause out of the parent prompt', async () => {
    const { supervisor, receivedPrompts } = setup();

    await supervisor.generate('go');

    const output = toolResultSeenByModel(receivedPrompts);
    expect(output.type).toBe('error-text');
    expect(output.value).toContain('Failed agent tool execution for head');
    expect(output.value).toBe(DEFAULT_ERROR);
    expect(JSON.stringify(receivedPrompts)).not.toContain(CAUSE);
  });
});
