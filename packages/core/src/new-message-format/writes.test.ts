import { convertArrayToReadableStream, MockLanguageModelV4 } from '@internal/ai-v7/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { trimResentInput } from './input-filter';
import { scriptedModel, textTurn, toolCallTurn } from './model.mock';
import { runAgent } from './run';
import { InMemoryActionStorage } from './storage';
import type { PersistableAction } from './types';
import { createUlid } from './ulid';

const drain = async (run: AsyncIterable<unknown>) => {
  for await (const _ of run) void _;
};
const texts = (log: PersistableAction[]) => log.flatMap(a => (a.type === 'text' ? [`${a.role}:${a.text}`] : []));

describe('when actions are written', () => {
  it('stores run-start and the input before the model is called', async () => {
    const memory = new InMemoryActionStorage();
    let atModelCall: PersistableAction[] = [];
    const model = new MockLanguageModelV4({
      modelId: 'mock-model',
      doStream: async () => {
        // The process could die here, before any turn-end: the input must already be in the log.
        atModelCall = await memory.listActions({ threadId: 't1' });
        throw new Error('provider down');
      },
    });

    // The stream reports the provider error as a part rather than throwing; either way the run is over.
    await drain(runAgent({ model, threadId: 't1', memory, agentId: 'a1', input: 'hello' })).catch(() => {});
    expect(atModelCall.map(a => a.type)).toEqual(['run-start', 'text']);
    expect(atModelCall[0]).toMatchObject({ type: 'run-start', agentId: 'a1', modelId: 'mock-model' });
    expect(texts(atModelCall)).toEqual(['user:hello']);
  });

  it('writes run-start once per run, not again when the run resumes', async () => {
    const memory = new InMemoryActionStorage();
    const { model } = scriptedModel([textTurn('one'), textTurn('two')]);
    await drain(runAgent({ model, threadId: 't1', memory, runId: 'r1', input: 'first' }));
    await drain(runAgent({ model, threadId: 't1', memory, runId: 'r1', input: 'again' }));
    const log = await memory.listActions({ threadId: 't1' });
    expect(log.filter(a => a.type === 'run-start')).toHaveLength(1);
  });
});

describe('agent without Memory', () => {
  const setup = () => {
    let executed = 0;
    const deleteFile = createTool({
      id: 'deleteFile',
      description: 'Delete a file',
      inputSchema: z.object({ path: z.string() }),
      requireApproval: true,
      execute: async () => {
        executed++;
        return { deleted: true };
      },
    });
    const { model } = scriptedModel([toolCallTurn('call-1', 'deleteFile', { path: '/tmp/x' }), textTurn('Deleted.')]);
    const agent = new Agent({
      id: 'files',
      name: 'files',
      instructions: 'Manage files.',
      model,
      tools: { deleteFile },
    });
    const storage = new InMemoryStore();
    new Mastra({ agents: { files: agent }, storage, logger: false });
    return { agent, storage, executed: () => executed };
  };

  it('records the run to the Mastra storage, creates the thread row, and approves from the log', async () => {
    const { agent, storage, executed } = setup();
    expect(await agent.getMemory()).toBeUndefined();

    const first = await (await agent.stream('Delete /tmp/x', { memory: { thread: 'th1', resource: 'u1' } })).result;
    const store = (await storage.getStore('memory'))!;
    expect(await store.getThreadById({ threadId: 'th1' })).toMatchObject({ id: 'th1', resourceId: 'u1' });
    const pending = (await store.listActions({ threadId: 'th1' })).find(a => a.type === 'tool-approval-requested');
    expect(pending).toBeDefined();
    expect(executed()).toBe(0);

    const runId = first.actions[0]!.runId!;
    await (
      await agent.approveToolCall({ runId, memory: { thread: 'th1', resource: 'u1' } })
    ).result;
    expect(executed()).toBe(1);
    const log = await store.listActions({ threadId: 'th1' });
    expect(log.some(a => a.type === 'tool-approval-responded' && a.approved)).toBe(true);
    expect(texts(log)).toEqual(['user:Delete /tmp/x', 'assistant:Deleted.']);
  });

  it('falls back to the runId as the thread and still declines from the log', async () => {
    const { agent, storage, executed } = setup();
    const first = await (await agent.stream('Delete /tmp/x')).result;
    const runId = first.actions[0]!.runId!;
    const store = (await storage.getStore('memory'))!;
    expect(await store.getThreadById({ threadId: runId })).toMatchObject({ id: runId, resourceId: runId });

    await (
      await agent.declineToolCall({ runId, reason: 'no' })
    ).result;
    expect(executed()).toBe(0);
    const log = await store.listActions({ threadId: runId });
    expect(log.some(a => a.type === 'tool-approval-responded' && !a.approved)).toBe(true);
  });
});

describe('resent history', () => {
  const ui = (id: string, role: 'user' | 'assistant', parts: unknown[]) => ({ id, role, parts });
  const uiText = (id: string, role: 'user' | 'assistant', text: string) => ui(id, role, [{ type: 'text', text }]);

  it('stores a useChat conversation once when the client resends it every turn', async () => {
    const memory = new InMemoryActionStorage();
    const { model, prompts } = scriptedModel([textTurn('Hi!'), textTurn('Fine.')]);
    const history = [uiText('m1', 'user', 'hello')];
    await drain(runAgent({ model, threadId: 't1', memory, input: history }));

    const resent = [...history, uiText('m2', 'assistant', 'Hi!'), uiText('m3', 'user', 'how are you?')];
    await drain(runAgent({ model, threadId: 't1', memory, input: resent }));

    const log = await memory.listActions({ threadId: 't1' });
    expect(texts(log)).toEqual(['user:hello', 'assistant:Hi!', 'user:how are you?', 'assistant:Fine.']);
    // The prompt is the log, not the log plus the resent copy.
    expect(JSON.stringify(prompts[1]).match(/hello/g)).toHaveLength(1);
  });

  const call = (toolCallId: string): PersistableAction => ({
    id: createUlid()(),
    threadId: 't1',
    createdAt: new Date(),
    type: 'tool-call',
    role: 'assistant',
    toolCallId,
    toolName: 'pick',
    input: {},
  });
  const resultFor = (toolCallId: string): PersistableAction => ({
    id: createUlid()(),
    threadId: 't1',
    createdAt: new Date(),
    type: 'tool-result',
    toolCallId,
    toolName: 'pick',
    output: 'old',
  });
  const clientResult = (toolCallId: string) => ({
    type: 'tool-pick',
    toolCallId,
    state: 'output-available',
    input: {},
    output: 'blue',
  });

  it('keeps a client tool result for a call the log still has open, alongside the next user message', () => {
    const log = [call('c1')];
    const input = [
      uiText('m1', 'user', 'pick a color'),
      ui('m2', 'assistant', [clientResult('c1')]),
      uiText('m3', 'user', 'thanks'),
    ];
    const { actions } = trimResentInput(input, log);
    expect(actions.map(a => a.type)).toEqual(['tool-result', 'text']);
    expect(actions[0]).toMatchObject({ toolCallId: 'c1', output: 'blue' });
  });

  it('keeps only the open tool result when the input ends in the assistant message', () => {
    const log = [call('c1'), resultFor('c0'), call('c0')];
    const input = [ui('m2', 'assistant', [clientResult('c0'), clientResult('c1')])];
    const { actions } = trimResentInput(input, log);
    expect(actions).toEqual([expect.objectContaining({ type: 'tool-result', toolCallId: 'c1' })]);
  });

  it('keeps few-shot examples sent ahead of a question on a thread with history', async () => {
    const memory = new InMemoryActionStorage();
    const { model } = scriptedModel([textTurn('Hi!'), textTurn('Positive.')]);
    await drain(runAgent({ model, threadId: 't1', memory, input: 'hello' }));

    const fewShot = [
      uiText('e1', 'user', 'I love it'),
      uiText('e2', 'assistant', 'Sentiment: positive'),
      uiText('q1', 'user', 'Great product'),
    ];
    await drain(runAgent({ model, threadId: 't1', memory, input: fewShot }));

    const log = await memory.listActions({ threadId: 't1' });
    expect(texts(log)).toEqual([
      'user:hello',
      'assistant:Hi!',
      'user:I love it',
      'assistant:Sentiment: positive',
      'user:Great product',
      'assistant:Positive.',
    ]);
  });

  it('keeps new assistant content that arrives with the result of an open call', () => {
    const log = [call('open')];
    const input = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking two things.' },
          { type: 'tool-call', toolCallId: 'new', toolName: 'pick', input: {} },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'open', toolName: 'pick', output: { type: 'text', value: 'blue' } },
        ],
      },
    ];
    const { actions } = trimResentInput(input, log);
    expect(actions.map(a => a.type)).toEqual(['text', 'tool-call', 'tool-result']);
    expect(actions[2]).toMatchObject({ toolCallId: 'open' });
  });

  it('stores a retried question once after its model call failed', async () => {
    const memory = new InMemoryActionStorage();
    const { model } = scriptedModel([textTurn('Hi!')]);
    await drain(runAgent({ model, threadId: 't1', memory, input: [uiText('m1', 'user', 'hello')] }));

    const failing = new MockLanguageModelV4({
      modelId: 'mock-model',
      doStream: async () => {
        throw new Error('provider down');
      },
    });
    const resent = [uiText('m1', 'user', 'hello'), uiText('m2', 'assistant', 'Hi!'), uiText('m3', 'user', 'what now?')];
    await drain(runAgent({ model: failing, threadId: 't1', memory, input: resent })).catch(() => {});

    const { model: retry } = scriptedModel([textTurn('This.')]);
    await drain(runAgent({ model: retry, threadId: 't1', memory, input: resent }));

    const log = await memory.listActions({ threadId: 't1' });
    expect(texts(log)).toEqual(['user:hello', 'assistant:Hi!', 'user:what now?', 'assistant:This.']);
  });

  it('treats matching tool-call ids as a resend', () => {
    const log = [call('c1'), resultFor('c1')];
    const input = [ui('m2', 'assistant', [{ ...clientResult('c1'), type: 'tool-pick' }]), uiText('m3', 'user', 'next')];
    expect(trimResentInput(input, log).actions.map(a => a.type)).toEqual(['text']);
  });

  it('keeps everything when the log is empty', () => {
    const input = [uiText('m1', 'user', 'a'), uiText('m2', 'assistant', 'b'), uiText('m3', 'user', 'c')];
    expect(trimResentInput(input, []).actions).toHaveLength(3);
  });
});
