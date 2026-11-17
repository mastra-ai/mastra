/**
 * `storeOnAccept` stores a sent user message as soon as `sendMessage` accepts it, before the
 * run reaches the model. Each test holds the woken run inside an input processor (before its
 * first model request) and reads the thread back from storage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { createTextStreamModel } from './signals-test-utils';

/** A text model that records which signal rows were in storage when the model request was made. */
function createRecordingModel(readStored: () => Promise<string[]>) {
  const storedAtRequest: string[][] = [];
  const inner = createTextStreamModel('reply');
  const doStream = inner.doStream.bind(inner);
  inner.doStream = async (options: any) => {
    storedAtRequest.push(await readStored());
    return doStream(options);
  };
  return { model: inner, storedAtRequest };
}

const resourceId = 'store-on-accept-user';
const threadId = 'store-on-accept-thread';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function createHarness({
  rejectInput = false,
  readOnly = false,
  model = createTextStreamModel('reply') as any,
  fga,
}: {
  rejectInput?: boolean;
  readOnly?: boolean;
  model?: any;
  fga?: IFGAProvider;
} = {}) {
  const reached = deferred();
  const gate = deferred();
  const holdingProcessor: Processor = {
    id: 'hold-before-model',
    async processInput({ messages, abort }) {
      reached.resolve();
      await gate.promise;
      if (rejectInput) abort('rejected by policy');
      return messages;
    },
  };
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, ...(readOnly ? { options: { readOnly: true } } : {}) });
  const agent = new Agent({
    id: 'store-on-accept-agent',
    name: 'Store On Accept Agent',
    instructions: 'Reply briefly.',
    memory,
    inputProcessors: [holdingProcessor],
    model,
  });
  const mastra = new Mastra({
    agents: { 'store-on-accept-agent': agent },
    logger: false,
    storage,
    ...(fga ? { server: { fga } } : {}),
  });

  const storedSignals = async () => {
    const store = await storage.getStore('memory');
    const { messages } = await store!.listMessages({ threadId, perPage: false });
    return messages.filter(message => message.role === 'signal');
  };
  const send = (contents: string, options: { storeOnAccept?: boolean; requestContext?: RequestContext } = {}) =>
    agent.sendMessage(
      { contents },
      {
        resourceId,
        threadId,
        ...(options.storeOnAccept ? { storeOnAccept: true } : {}),
        ifIdle: {
          streamOptions: {
            memory: { resource: resourceId, thread: threadId },
            ...(options.requestContext ? { requestContext: options.requestContext } : {}),
          },
        },
      },
    );

  return { agent, mastra, storage, memory, storedSignals, send, reached: reached.promise, release: gate.resolve };
}

async function createThread(h: ReturnType<typeof createHarness>) {
  await h.memory.saveThread({
    thread: { id: threadId, resourceId, title: 'stored', createdAt: new Date(), updatedAt: new Date() },
  });
}

/** Give a fire-and-forget write ample time to land before asserting it did not. */
function settle() {
  return new Promise(resolve => setTimeout(resolve, 50));
}

describe('sendMessage storeOnAccept', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('without the option, nothing is stored before the run saves its turn', async () => {
    const h = createHarness();
    await createThread(h);

    const result = h.send('hello');
    await h.reached;
    await settle();
    expect(await h.storedSignals()).toEqual([]);

    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();
  });

  it('without the option, a message an input processor rejects is never stored', async () => {
    const h = createHarness({ rejectInput: true });
    await createThread(h);

    const result = h.send('forbidden');
    await h.reached;
    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();
    await settle();

    expect(await h.storedSignals()).toEqual([]);
  });

  it('with the option, the message is stored before the first model request', async () => {
    const h = createHarness();
    await createThread(h);

    const result = h.send('hello', { storeOnAccept: true });
    await h.reached;
    await vi.waitFor(async () => {
      const stored = await h.storedSignals();
      expect(stored.map(message => message.id)).toEqual([result.signal.id]);
    });

    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();
    expect((await h.storedSignals()).map(message => message.id)).toEqual([result.signal.id]);
  });

  it('with the option, a message an input processor rejects stays stored (documented trade-off)', async () => {
    const h = createHarness({ rejectInput: true });
    await createThread(h);

    const result = h.send('forbidden', { storeOnAccept: true });
    await h.reached;
    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();
    await settle();

    expect((await h.storedSignals()).map(message => message.id)).toEqual([result.signal.id]);
  });

  it('read-only memory stores nothing early', async () => {
    const h = createHarness({ readOnly: true });
    await createThread(h);

    h.send('hello', { storeOnAccept: true });
    await h.reached;
    await settle();

    expect(await h.storedSignals()).toEqual([]);
    h.release();
  });

  it('a denied MEMORY_WRITE check stores nothing early', async () => {
    const fga: IFGAProvider = {
      check: vi.fn(async () => true),
      require: vi.fn(async (_user, input) => {
        if (input.permission === 'memory:write') {
          throw new FGADeniedError({ id: 'user-1' }, input.resource, input.permission);
        }
      }),
      filterAccessible: vi.fn(async (_user, resources) => resources),
    } as unknown as IFGAProvider;
    const h = createHarness({ fga });
    await createThread(h);
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });

    h.send('hello', { storeOnAccept: true, requestContext });
    await h.reached;
    await settle();

    expect(fga.require).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ permission: 'memory:write', resource: { type: 'thread', id: threadId } }),
    );
    expect(await h.storedSignals()).toEqual([]);
  });

  it('gateway-managed memory stores nothing early', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk_live_project_key');
    const h = createHarness({ model: new ModelRouterLanguageModel('mastra/openai/gpt-4o') });
    await createThread(h);

    h.send('hello', { storeOnAccept: true });
    await h.reached;
    await settle();

    expect(await h.storedSignals()).toEqual([]);
  });

  it('a gateway model whose memory stays local stores the message early', async () => {
    vi.stubEnv('MASTRA_GATEWAY_API_KEY', 'msk-gateway-org-key');
    const h = createHarness({ model: new ModelRouterLanguageModel('mastra/openai/gpt-4o') });
    await createThread(h);

    const result = h.send('hello', { storeOnAccept: true });
    await h.reached;

    await vi.waitFor(async () => {
      expect((await h.storedSignals()).map(message => message.id)).toEqual([result.signal.id]);
    });
  });

  it('a thread row that does not exist yet is stored by the run before its model request', async () => {
    let read: () => Promise<string[]> = async () => [];
    const recording = createRecordingModel(() => read());
    const h = createHarness({ model: recording.model });
    read = async () => (await h.storedSignals()).map(message => message.id);

    // No thread row: the acceptance write must not throw or store a row for a missing thread.
    const result = h.send('hello', { storeOnAccept: true });
    await h.reached;
    await settle();
    expect(await h.storedSignals()).toEqual([]);

    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();

    expect(recording.storedAtRequest).toEqual([[result.signal.id]]);
  });

  it('a failed acceptance write logs a warning and is stored by the run before its model request', async () => {
    let read: () => Promise<string[]> = async () => [];
    const recording = createRecordingModel(() => read());
    const h = createHarness({ model: recording.model });
    read = async () => (await h.storedSignals()).map(message => message.id);
    await createThread(h);
    const warn = vi.spyOn(h.mastra.getLogger(), 'warn');
    const store = (await h.storage.getStore('memory'))!;
    const saveMessages = store.saveMessages.bind(store);
    let failures = 1;
    vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
      if (failures-- > 0) throw new Error('storage unavailable');
      return saveMessages(args);
    });

    const result = h.send('hello', { storeOnAccept: true });
    await h.reached;
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        'Could not store a sent message when it was accepted',
        expect.objectContaining({ signalId: result.signal.id }),
      ),
    );
    expect(await h.storedSignals()).toEqual([]);

    h.release();
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();

    expect(accepted.output.status).toBe('success');
    expect(recording.storedAtRequest).toEqual([[result.signal.id]]);
  });
});
