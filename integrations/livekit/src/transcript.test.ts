import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { initializeLogger, llm, voice } from '@livekit/agents';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraVoiceAgent } from './bridge';
import { MastraLLM } from './llm-plugin';
import { createLiveKitTranscriptPersistence } from './transcript';
import type { CreateLiveKitTranscriptPersistenceOptions } from './transcript';

beforeAll(() => initializeLogger({ level: 'silent', pretty: false }));
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

export function commit(session: voice.AgentSession, item: llm.ChatMessage): void {
  session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
    type: voice.AgentSessionEventTypes.ConversationItemAdded,
    item,
    createdAt: Date.now(),
  });
}

const message = (id: string, role: 'user' | 'assistant', text: string, createdAt = Date.now(), interrupted = false) =>
  llm.ChatMessage.create({ id, role, content: text, createdAt, interrupted });

async function readReply(plugin: MastraLLM, items: llm.ChatMessage[]): Promise<string> {
  const stream = plugin.chat({
    chatCtx: new llm.ChatContext(items),
    connOptions: { maxRetry: 0, retryIntervalMs: 0, timeoutMs: 1000 },
  });
  let text = '';
  for await (const chunk of stream) text += chunk.delta?.content ?? '';
  return text;
}

async function fixture(
  overrides: Partial<CreateLiveKitTranscriptPersistenceOptions> = {},
  memoryConfig: ConstructorParameters<typeof Memory>[0] = {},
) {
  const storage = new LibSQLStore({ id: crypto.randomUUID(), url: ':memory:' });
  cleanups.push(() => storage.close());
  const memory = new Memory({
    ...memoryConfig,
    storage,
    options: { lastMessages: 100, semanticRecall: false, ...memoryConfig.options },
  });
  const prompts: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(options.prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'Generated answer, including unheard words.' },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
        ]),
      };
    },
  });
  const agent = new Agent({ id: 'support', name: 'Support', instructions: 'Help the caller.', memory, model });
  const persistence = await createLiveKitTranscriptPersistence({
    agent,
    sessionId: 'job-1',
    memory: { thread: 'thread', resource: 'caller' },
    ...overrides,
  } as CreateLiveKitTranscriptPersistenceOptions);
  const plugin = new MastraLLM({ transcriptPersistence: persistence });
  const session = new voice.AgentSession({});
  persistence.attach(session);
  cleanups.push(() => persistence.close());
  const recall = async () =>
    (await memory.recall({ threadId: 'thread', resourceId: 'caller', perPage: false })).messages;
  return { storage, memory, prompts, model, agent, persistence, plugin, session, recall };
}

describe('committed transcript persistence with real Mastra Memory and LibSQL', () => {
  it('reads working memory without offering its update tool', async () => {
    const f = await fixture({}, { options: { workingMemory: { enabled: true } } });
    await f.memory.updateWorkingMemory({
      threadId: 'thread',
      resourceId: 'caller',
      workingMemory: 'Caller prefers quiet rooms.',
    });
    const update = vi.spyOn(f.memory, 'updateWorkingMemory');
    await readReply(f.plugin, [message('u', 'user', 'Find a room')]);
    expect(JSON.stringify(f.prompts)).toContain('Caller prefers quiet rooms');
    expect(JSON.stringify(f.model.doStreamCalls[0]?.tools ?? [])).not.toContain('updateWorkingMemory');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not start observational-memory writes for speculative generation', async () => {
    const observer = new MockLanguageModelV2();
    const f = await fixture(
      {},
      {
        options: {
          observationalMemory: {
            enabled: true,
            observation: { model: observer, messageTokens: 1, bufferTokens: false },
          },
        },
      },
    );
    await readReply(f.plugin, [message('draft', 'user', 'This draft should not trigger observations')]);
    expect(observer.doGenerateCalls).toHaveLength(0);
    expect(observer.doStreamCalls).toHaveLength(0);
    expect(await f.recall()).toEqual([]);
  });

  it('does not start generation if cancelled while waiting for storage', async () => {
    const f = await fixture();
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const save = f.memory.saveMessages.bind(f.memory);
    vi.spyOn(f.memory, 'saveMessages').mockImplementationOnce(async args => {
      await blocked;
      return save(args);
    });
    const input = message('u', 'user', 'Question');
    commit(f.session, input);
    const stream = f.plugin.chat({ chatCtx: new llm.ChatContext([input]) });
    await new Promise(resolve => setTimeout(resolve, 5));
    stream.close();
    release();
    await f.persistence.flush();
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(f.prompts).toHaveLength(0);
  });
  it('captures real native session events for a greeting and a generated text turn', async () => {
    const f = await fixture();
    await f.session.start({
      agent: new voice.Agent({ instructions: 'Unused LiveKit instructions', llm: f.plugin }),
      outputOptions: { audioEnabled: false, transcriptionEnabled: false },
    });
    await f.session.say('Native greeting').waitForPlayout();
    await f.session.generateReply({ userInput: 'Native question' }).waitForPlayout();
    await f.persistence.close();
    const rows = await f.recall();
    expect(rows.map(row => row.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(rows.map(row => row.content.parts[0])).toMatchObject([
      { text: 'Native greeting' },
      { text: 'Native question' },
      { text: 'Generated answer, including unheard words.' },
    ]);
  });
  it('keeps each committed input once in the next prompt and never stores generated drafts', async () => {
    const f = await fixture();
    const first = message('u1', 'user', 'First question');
    commit(f.session, first);
    expect(await readReply(f.plugin, [first])).toContain('unheard words');
    expect((await f.recall()).map(m => m.role)).toEqual(['user']);
    const partial = message('a1', 'assistant', 'Actually spoken', Date.now(), true);
    const second = message('u2', 'user', 'Second question');
    commit(f.session, partial);
    commit(f.session, second);
    await readReply(f.plugin, [first, partial, second]);
    const prompt = JSON.stringify(f.prompts[1]);
    expect(prompt.match(/First question/g)).toHaveLength(1);
    expect(prompt.match(/Actually spoken/g)).toHaveLength(1);
    expect(prompt.match(/Second question/g)).toHaveLength(1);
    expect(prompt).not.toContain('unheard words');
    expect((await f.recall()).map(m => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('does not persist speculative inputs or replies without native commitment', async () => {
    const f = await fixture();
    await readReply(f.plugin, [message('draft', 'user', 'Maybe I want')]);
    expect(await f.recall()).toEqual([]);
    const final = message('final', 'user', 'Actually I need help');
    commit(f.session, final);
    await readReply(f.plugin, [final]);
    expect(await f.recall()).toHaveLength(1);
    expect(JSON.stringify(f.prompts[1])).not.toContain('Maybe I want');
  });

  it('snapshots native text, skips blank/nonconversation items, and upserts revisions in order', async () => {
    const f = await fixture();
    const item = message('a', 'assistant', '  Hello  ', 10, true);
    const received: MastraDBMessage[] = [];
    const save = f.memory.saveMessages.bind(f.memory);
    vi.spyOn(f.memory, 'saveMessages').mockImplementation(args => {
      received.push(...structuredClone(args.messages));
      return save(args);
    });
    commit(f.session, item);
    item.content = ['mutated after emission'];
    await f.persistence.flush();
    let rows = await f.recall();
    expect(received[0]?.content.parts[0]).toMatchObject({ text: '  Hello  ' });
    // Memory.saveMessages applies its existing working-memory-tag/whitespace normalization.
    expect(rows[0]?.content.parts[0]).toMatchObject({ text: 'Hello' });
    expect(rows[0]?.content.metadata).toMatchObject({ interrupted: true, nativeCreatedAt: 10, liveKitItemId: 'a' });
    const id = rows[0]!.id;
    commit(f.session, message('a', 'assistant', 'Resumed native text', 10));
    commit(f.session, message('a', 'assistant', 'Resumed native text', 10));
    commit(f.session, message('empty', 'user', '  '));
    commit(f.session, llm.ChatMessage.create({ role: 'system', content: 'instructions' }));
    await f.persistence.flush();
    rows = await f.recall();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      content: { parts: [{ type: 'text', text: 'Resumed native text' }], metadata: { interrupted: false } },
    });
  });

  it('preserves event order for equal timestamps through the existing recall API', async () => {
    const f = await fixture();
    for (const [id, role] of [
      ['z', 'user'],
      ['a', 'assistant'],
      ['m', 'user'],
    ] as const) {
      commit(f.session, message(id, role, id, 100));
    }
    await f.persistence.flush();
    const rows = await f.recall();
    expect(rows.map(m => m.content.metadata?.liveKitItemId)).toEqual(['z', 'a', 'm']);
    expect(rows.map(m => m.createdAt.getTime())).toEqual([100, 101, 102]);
    expect(rows.map(m => m.content.metadata?.nativeCreatedAt)).toEqual([100, 100, 100]);
  });

  it('retains thread ownership, title and unrelated metadata on sequential sessions', async () => {
    const f = await fixture();
    await f.memory.updateThread({ id: 'thread', title: 'Existing title', metadata: { business: 'value' } });
    commit(f.session, message('original', 'user', 'First call', 100));
    await f.persistence.close();
    const next = await createLiveKitTranscriptPersistence({
      agent: f.agent,
      sessionId: 'job-2',
      memory: { thread: 'thread', resource: 'caller' },
    });
    cleanups.push(() => next.close());
    expect(await f.memory.getThreadById({ threadId: 'thread' })).toMatchObject({
      title: 'Existing title',
      resourceId: 'caller',
      metadata: { business: 'value' },
    });
    await expect(
      createLiveKitTranscriptPersistence({
        agent: f.agent,
        sessionId: 'other',
        memory: { thread: 'thread', resource: 'intruder' },
      }),
    ).rejects.toThrow(/different resource/);
    expect(await f.recall()).toHaveLength(1);
  });

  it('handles a lost acknowledgement by retrying the same snapshot, without duplicated rows', async () => {
    const f = await fixture();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const save = f.memory.saveMessages.bind(f.memory);
    const spy = vi.spyOn(f.memory, 'saveMessages').mockImplementationOnce(async args => {
      await save(args);
      throw new Error('lost acknowledgement containing private text');
    });
    commit(f.session, message('u', 'user', 'Private text', 100));
    expect(await f.persistence.flush()).toMatchObject({ failed: 1, pending: 0 });
    const errors: unknown[] = [];
    f.plugin.on('error', error => errors.push(error));
    await readReply(f.plugin, [message('next', 'user', 'Next')]);
    expect(errors).toMatchObject([
      { error: { message: expect.stringMatching(/preceding transcript writes failed/) }, recoverable: false },
    ]);
    expect(f.prompts).toHaveLength(0);
    expect(await f.persistence.flush({ retryFailed: true })).toMatchObject({ failed: 0, saved: 1 });
    expect(spy.mock.calls[0]![0].messages).toEqual(spy.mock.calls[1]![0].messages);
    expect(await f.recall()).toHaveLength(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('Private text');
  });

  it('does not replay a failed older revision after a newer revision was saved', async () => {
    const f = await fixture();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.spyOn(f.memory, 'saveMessages').mockRejectedValueOnce(new Error('unavailable'));
    commit(f.session, message('a', 'assistant', 'partial', 100, true));
    commit(f.session, message('a', 'assistant', 'final', 100));
    expect(await f.persistence.flush({ retryFailed: true })).toMatchObject({ saved: 1, failed: 0 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await f.recall())[0]?.content.parts[0]).toMatchObject({ text: 'final' });
  });

  it('queues without invoking storage synchronously, and only waits at the generation boundary', async () => {
    const waits: number[] = [];
    const f = await fixture({ onBarrier: elapsed => waits.push(elapsed) });
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const save = f.memory.saveMessages.bind(f.memory);
    const spy = vi.spyOn(f.memory, 'saveMessages').mockImplementationOnce(async args => {
      await blocked;
      return save(args);
    });
    const input = message('u', 'user', 'Question');
    commit(f.session, input);
    expect(spy).not.toHaveBeenCalled();
    const reply = readReply(f.plugin, [input]);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(f.prompts).toHaveLength(0);
    release();
    await reply;
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThanOrEqual(10);
  });

  it('preserves tool calls/results/errors as structured history and never labels them as speech', async () => {
    const f = await fixture();
    const input = message('u', 'user', 'Look up my booking');
    commit(f.session, input);
    const stream = vi.spyOn(f.agent, 'stream').mockResolvedValueOnce({
      fullStream: (async function* () {
        yield { type: 'tool-call', payload: { toolCallId: 'call', toolName: 'lookup', args: { id: 1 } } };
        yield {
          type: 'tool-result',
          payload: { toolCallId: 'call', toolName: 'lookup', result: { booking: 'confirmed' } },
        };
        yield { type: 'tool-call', payload: { toolCallId: 'error', toolName: 'lookup', args: { id: 2 } } };
        yield { type: 'tool-error', payload: { toolCallId: 'error', toolName: 'lookup', error: 'not found' } };
        yield { type: 'tool-call', payload: { toolCallId: 'pending', toolName: 'lookup', args: { id: 3 } } };
        yield { type: 'text-delta', payload: { text: 'Uncommitted answer' } };
      })(),
    } as unknown as Awaited<ReturnType<Agent['stream']>>);
    await readReply(f.plugin, [input]);
    await f.persistence.flush();
    stream.mockRestore();
    const rows = await f.recall();
    expect(rows).toHaveLength(4);
    const toolRows = rows.filter(row => row.content.metadata?.kind === 'tool');
    expect(toolRows.map(row => row.content.parts[0])).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', args: { id: 1 }, result: { booking: 'confirmed' } },
      },
      { type: 'tool-invocation', toolInvocation: { state: 'output-error', errorText: 'not found' } },
      { type: 'tool-invocation', toolInvocation: { state: 'call' } },
    ]);
    const prompt = new MessageList().add(rows, 'memory').get.all.aiV5.model();
    expect(JSON.stringify(prompt)).toContain('confirmed');
    expect(JSON.stringify(prompt)).not.toContain('Uncommitted answer');
    // Agent prompt conversion sanitizes incomplete pairs; raw history still retains the call.
    await readReply(f.plugin, [
      input,
      message('a', 'assistant', 'Partial spoken text', Date.now(), true),
      message('u2', 'user', 'Continue'),
    ]);
    expect(JSON.stringify(f.prompts[0])).not.toContain('pending');
    expect(JSON.stringify(f.prompts[0])).toContain('confirmed');
  });

  it('lets the current reply stream while tool persistence is blocked', async () => {
    const f = await fixture();
    const input = message('u', 'user', 'Question');
    commit(f.session, input);
    await f.persistence.flush();
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const save = f.memory.saveMessages.bind(f.memory);
    vi.spyOn(f.memory, 'saveMessages').mockImplementation(async args => {
      await blocked;
      return save(args);
    });
    vi.spyOn(f.agent, 'stream').mockResolvedValueOnce({
      fullStream: (async function* () {
        yield { type: 'tool-call', payload: { toolCallId: 'c', toolName: 'lookup', args: {} } };
        yield { type: 'tool-result', payload: { toolCallId: 'c', toolName: 'lookup', result: 'done' } };
        yield { type: 'text-delta', payload: { text: 'Immediate reply' } };
      })(),
    } as unknown as Awaited<ReturnType<Agent['stream']>>);
    expect(await readReply(f.plugin, [input])).toBe('Immediate reply');
    expect(f.persistence.status.pending).toBe(1);
    release();
    await f.persistence.flush();
  });

  it('closes the native session before draining final items and detaches exactly once', async () => {
    const f = await fixture();
    const close = vi.spyOn(f.session, 'close').mockImplementation(async () => {
      commit(f.session, message('final', 'assistant', 'Goodbye', 100, true));
    });
    const result = await f.persistence.close();
    expect(result).toEqual({ saved: 1, failed: 0, pending: 0 });
    await f.persistence.close();
    expect(close).toHaveBeenCalledTimes(1);
    expect(f.session.listenerCount(voice.AgentSessionEventTypes.ConversationItemAdded)).toBe(0);
    expect((await f.recall())[0]?.content.metadata?.interrupted).toBe(true);
  });

  it('reports an incomplete shutdown when storage does not finish within the budget', async () => {
    const f = await fixture({ shutdownTimeoutMs: 15 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const save = f.memory.saveMessages.bind(f.memory);
    vi.spyOn(f.memory, 'saveMessages').mockImplementation(async args => {
      await blocked;
      return save(args);
    });
    commit(f.session, message('u', 'user', 'Question'));
    expect(await f.persistence.close()).toMatchObject({ pending: 1, failed: 1 });
    release();
    await f.persistence.flush();
  });

  it('rejects conflicting settings and duplicate owners before generation', async () => {
    const f = await fixture();
    expect(() => f.persistence.attach(f.session)).toThrow(/already attached/);
    expect(() => new MastraLLM({ transcriptPersistence: f.persistence })).toThrow(/generation source/);
    expect(() => new MastraLLM({ transcriptPersistence: f.persistence, memory: false })).toThrow(/supplies/);
    expect(
      () =>
        new MastraVoiceAgent({
          transcriptPersistence: f.persistence,
          streamOptions: { requestContext: new RequestContext([['tenant', 'different']]) },
        }),
    ).toThrow(/supplies/);
    await expect(
      createLiveKitTranscriptPersistence({
        agent: f.agent,
        sessionId: 'j',
        memory: { thread: 'thread', options: { readOnly: false } },
      }),
    ).rejects.toThrow();
    await expect(
      createLiveKitTranscriptPersistence({ agent: f.agent, sessionId: '', memory: { thread: 'thread' } }),
    ).rejects.toThrow();
  });
});
