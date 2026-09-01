import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { reconstructRemindContinuationView, RemindContinuationProcessor } from '../subconscious/remind-continuation';
import {
  ensureOwnedRemindThread,
  getRemindProtocol,
  getRemindThreadId,
  REMIND_DELIVERY_METADATA_KEY,
  REMIND_PROTOCOL_METADATA_KEY,
  RemindEventReferenceProcessor,
} from '../subconscious/remind-protocol';
import type { RemindProtocolEvent } from '../subconscious/remind-protocol';

const parentThreadId = 'parent-thread';
const resourceId = 'resource-1';
const parentAgentId = 'parent-agent';
const reminderThreadId = getRemindThreadId(parentThreadId);

function base(eventId: string, createdAt: number) {
  return {
    eventId,
    deliveryId: `${eventId}:delivery`,
    parentAgentId,
    parentThreadId,
    resourceId,
    createdAt,
  };
}

function message(event: RemindProtocolEvent, text = event.kind): MastraDBMessage {
  return {
    id: event.eventId,
    role: 'user',
    threadId: reminderThreadId,
    resourceId,
    createdAt: new Date(event.createdAt),
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      metadata: { [REMIND_PROTOCOL_METADATA_KEY]: event },
    },
  };
}

function question(replyId: string, createdAt: number): RemindProtocolEvent {
  return {
    kind: 'question',
    ...base(`${replyId}:question`, createdAt),
    replyId,
    replyRequired: true,
  };
}

function partial(replyId: string, sequence: number, createdAt: number): RemindProtocolEvent {
  return {
    kind: 'partial-reply',
    ...base(`${replyId}:partial:${sequence}`, createdAt),
    replyId,
    sequence,
    moreComing: true,
  };
}

function continuation(replyIds: string[], attempts: Record<string, number>, createdAt: number): RemindProtocolEvent {
  return {
    kind: 'continuation',
    ...base(`continuation-${createdAt}`, createdAt),
    outstandingReplyIds: replyIds,
    attempts,
  };
}

function terminalDelivered(replyId: string, createdAt: number): RemindProtocolEvent {
  return {
    kind: 'terminal-delivered',
    ...base(`${replyId}:terminal:delivered`, createdAt),
    replyId,
    outcome: 'answer',
  };
}

async function setup(events: RemindProtocolEvent[] = []) {
  const memory = new Memory({ storage: new InMemoryStore() });
  await ensureOwnedRemindThread({ memory, parentThreadId, resourceId });
  if (events.length) await memory.saveMessages({ messages: events.map(event => message(event)) });
  return memory;
}

async function protocols(memory: Memory) {
  const store = await memory.storage.getStore('memory');
  const result = await store!.listMessages({
    threadId: reminderThreadId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return result.messages.flatMap(stored => {
    const event = getRemindProtocol(stored);
    return event ? [event] : [];
  });
}

function createHarness(
  memory: Memory,
  options?: { continuationAction?: 'wake' | 'deliver' | 'blocked'; parentAction?: 'deliver' | 'blocked' },
) {
  const parentSignals: unknown[] = [];
  const parentAgent = {
    id: parentAgentId,
    sendSignal: vi.fn((signal: unknown) => {
      parentSignals.push(signal);
      return { accepted: Promise.resolve({ action: options?.parentAction ?? 'deliver', runId: 'parent-run' }) };
    }),
  } as any;
  const consumeStream = vi.fn(async () => undefined);
  const sendMessage = vi.fn(() => {
    const action = options?.continuationAction ?? 'deliver';
    return {
      accepted: Promise.resolve(
        action === 'wake'
          ? { action, runId: 'sidekick-run', output: { consumeStream } }
          : { action, runId: 'sidekick-run' },
      ),
    };
  });
  const reminderAgent = { id: 'reminder-agent', sendMessage } as any;
  const processor = new RemindContinuationProcessor({
    memory,
    threadId: reminderThreadId,
    resourceId,
    parentThreadId,
    parentAgent,
    parentAgentId,
    maxSteps: 7,
    getReminderAgent: () => reminderAgent,
  });
  return { processor, parentAgent, parentSignals, reminderAgent, sendMessage, consumeStream };
}

function resultArgs(overrides: Record<string, unknown> = {}) {
  return {
    state: {},
    messages: [],
    messageList: { get: { all: { db: () => [] } } },
    result: { text: '', usage: {}, finishReason: 'stop', steps: [] },
    abort: vi.fn(),
    retryCount: 0,
    ...overrides,
  } as any;
}

describe('Subconscious reminder continuation', () => {
  it('reconstructs an unresolved question beyond the model context window and preserves its timestamp', async () => {
    const replyId = 'reply-old';
    const createdAt = 1_000;
    const memory = await setup([question(replyId, createdAt)]);
    const filler = Array.from(
      { length: 125 },
      (_, index): MastraDBMessage => ({
        id: `filler-${index}`,
        role: 'assistant',
        threadId: reminderThreadId,
        resourceId,
        createdAt: new Date(2_000 + index),
        content: { format: 2, parts: [{ type: 'text', text: `filler ${index}` }] },
      }),
    );
    await memory.saveMessages({ messages: filler });

    const view = await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId });

    expect(view.outstanding.get(replyId)).toEqual({
      replyId,
      createdAt,
      attempts: 0,
      moreComing: false,
      terminalPending: false,
    });
  });

  it('uses the newest continuation snapshot as a cutoff and finds older question origins', async () => {
    const memory = await setup([
      question('reply-a', 100),
      question('reply-b', 200),
      continuation(['reply-a', 'reply-b'], { 'reply-a': 1, 'reply-b': 1 }, 300),
      terminalDelivered('reply-a', 400),
      partial('reply-b', 1, 500),
    ]);

    const view = await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId });

    expect([...view.outstanding.values()]).toEqual([
      { replyId: 'reply-b', createdAt: 200, attempts: 1, moreComing: true, terminalPending: false },
    ]);
  });

  it('resolves a continuation reference to a model prompt without exposing its ledger metadata', async () => {
    const event = continuation(['reply-a'], { 'reply-a': 1 }, 200);
    const memory = await setup([question('reply-a', 100)]);
    await memory.saveMessages({
      messages: [message(event, 'Continue unresolved memory questions: reply-a. Reply with the reply tool.')],
    });
    const processor = new RemindEventReferenceProcessor(
      memory,
      reminderThreadId,
      resourceId,
      'reply_to_memory_question',
      parentAgentId,
    );
    const reference: MastraDBMessage = {
      id: event.deliveryId,
      role: 'signal',
      threadId: reminderThreadId,
      resourceId,
      createdAt: new Date(201),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Resolve continuation.' }],
        metadata: { [REMIND_DELIVERY_METADATA_KEY]: { eventId: event.eventId } },
      },
    };

    const result = await processor.processInputStep({
      messages: [reference],
      tools: { reply_to_memory_question: {} },
      activeTools: ['reply_to_memory_question'],
    } as any);

    expect(result && 'messages' in result ? result.messages : []).toEqual([
      expect.objectContaining({
        role: 'user',
        content: expect.objectContaining({
          parts: [
            expect.objectContaining({
              text: expect.stringContaining('Continue unresolved memory questions'),
            }),
          ],
        }),
      }),
    ]);
    const modelMessage = result && 'messages' in result ? result.messages[0] : undefined;
    expect(getRemindProtocol(modelMessage!)).toBeUndefined();
    expect((await protocols(memory)).filter(protocol => protocol.kind === 'continuation')).toHaveLength(1);
  });

  it('nudges once inside a run before allowing post-completion continuation', async () => {
    const memory = await setup([question('reply-a', 100)]);
    const { processor } = createHarness(memory);
    const sendSignal = vi.fn(async () => ({ id: 'nudge' }));
    const abort = vi.fn(() => {
      throw new Error('retry');
    });

    await expect(
      processor.processOutputStep(
        resultArgs({ finishReason: 'stop', stepNumber: 0, usage: {}, steps: [], sendSignal, abort }) as any,
      ),
    ).rejects.toThrow('retry');
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reactive', tagName: 'remind-continuation' }),
    );
    expect(abort).toHaveBeenCalledWith(expect.stringContaining('Outstanding memory questions'), {
      retry: true,
      metadata: { replyIds: ['reply-a'] },
    });

    await processor.processOutputStep(
      resultArgs({
        finishReason: 'stop',
        stepNumber: 1,
        usage: {},
        steps: [],
        sendSignal,
        abort,
        retryCount: 1,
      }) as any,
    );
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it.each(['wake', 'deliver'] as const)('persists a continuation before native %s routing', async action => {
    const memory = await setup([question('reply-a', 100)]);
    const { processor, sendMessage, consumeStream } = createHarness(memory, { continuationAction: action });
    const order: string[] = [];
    const store = await memory.storage.getStore('memory');
    const originalSave = store!.saveMessages.bind(store);
    vi.spyOn(store!, 'saveMessages').mockImplementation(async args => {
      if (getRemindProtocol(args.messages[0]!)?.kind === 'continuation') order.push('persist');
      return originalSave(args);
    });
    sendMessage.mockImplementation(() => {
      order.push('route');
      return {
        accepted: Promise.resolve(
          action === 'wake'
            ? { action, runId: 'sidekick-run', output: { consumeStream } }
            : { action, runId: 'sidekick-run' },
        ),
      };
    });

    await processor.processOutputResult(resultArgs());

    expect(order).toEqual(['persist', 'route']);
    expect((await protocols(memory)).filter(event => event.kind === 'continuation')).toEqual([
      expect.objectContaining({ outstandingReplyIds: ['reply-a'], attempts: { 'reply-a': 1 } }),
    ]);
    if (action === 'wake') await vi.waitFor(() => expect(consumeStream).toHaveBeenCalledOnce());
  });

  it('allows two reconstructed continuation wakes, then emits one deterministic terminal answer', async () => {
    const memory = await setup([question('reply-a', 100)]);
    const first = createHarness(memory);
    await first.processor.processOutputResult(resultArgs());
    const second = createHarness(memory);
    await second.processor.processOutputResult(resultArgs());
    const third = createHarness(memory);
    await third.processor.processOutputResult(resultArgs());
    const fourth = createHarness(memory);
    await fourth.processor.processOutputResult(resultArgs());

    const events = await protocols(memory);
    expect(events.filter(event => event.kind === 'continuation')).toHaveLength(2);
    expect(events.filter(event => event.kind === 'terminal-delivered')).toEqual([
      expect.objectContaining({ replyId: 'reply-a', outcome: 'unable-to-answer' }),
    ]);
    expect(third.parentSignals).toEqual([
      expect.objectContaining({
        id: 'reply-a:terminal:signal',
        attributes: expect.objectContaining({ outcome: 'unable-to-answer', moreComing: false }),
      }),
    ]);
    expect(fourth.parentSignals).toHaveLength(0);
  });

  it('records two failed terminal delivery attempts and never sends again after exhaustion', async () => {
    const replyId = 'reply-a';
    const memory = await setup([question(replyId, 100), continuation([replyId], { [replyId]: 2 }, 200)]);
    const first = createHarness(memory, { parentAction: 'blocked' });
    await first.processor.processOutputResult(resultArgs());
    const second = createHarness(memory, { parentAction: 'blocked' });
    await second.processor.processOutputResult(resultArgs());

    expect(first.parentSignals).toHaveLength(2);
    expect(second.parentSignals).toHaveLength(0);
    expect((await protocols(memory)).filter(event => event.kind === 'delivery-failure')).toEqual([
      expect.objectContaining({ attempt: 1, exhausted: false }),
      expect.objectContaining({ attempt: 2, exhausted: true }),
    ]);
  });

  it('keeps partial moreComing unresolved and stops immediately after terminal delivery', async () => {
    const memory = await setup([question('reply-a', 100), partial('reply-a', 1, 200)]);
    expect(
      (await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId })).outstanding.get(
        'reply-a',
      ),
    ).toMatchObject({ moreComing: true });

    await memory.saveMessages({ messages: [message(terminalDelivered('reply-a', 300))] });
    expect(
      (await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId })).outstanding,
    ).toHaveLength(0);
  });

  it('batches retryable IDs while terminalizing independently exhausted IDs', async () => {
    const memory = await setup([
      question('reply-a', 100),
      question('reply-b', 110),
      continuation(['reply-a', 'reply-b'], { 'reply-a': 1, 'reply-b': 1 }, 200),
      continuation(['reply-a', 'reply-b'], { 'reply-a': 2, 'reply-b': 1 }, 300),
    ]);
    const harness = createHarness(memory);

    await harness.processor.processOutputResult(resultArgs());

    const events = await protocols(memory);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'terminal-delivered', replyId: 'reply-a' }));
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'continuation',
        outstandingReplyIds: ['reply-b'],
        attempts: { 'reply-b': 2 },
      }),
    );
  });

  it('consumes a persisted attempt when continuation routing is rejected', async () => {
    const memory = await setup([question('reply-a', 100)]);
    const first = createHarness(memory, { continuationAction: 'blocked' });
    await first.processor.processOutputResult(resultArgs());
    const afterFirst = await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId });
    expect(afterFirst.outstanding.get('reply-a')?.attempts).toBe(1);

    const second = createHarness(memory, { continuationAction: 'blocked' });
    await second.processor.processOutputResult(resultArgs());
    const afterSecond = await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId });
    expect(afterSecond.outstanding.get('reply-a')?.attempts).toBe(2);
  });

  it('deduplicates duplicate completion hooks within one run', async () => {
    const memory = await setup([question('reply-a', 100)]);
    const harness = createHarness(memory);
    const args = resultArgs();

    await Promise.all([harness.processor.processOutputResult(args), harness.processor.processOutputResult(args)]);

    expect(harness.sendMessage).toHaveBeenCalledOnce();
    expect((await protocols(memory)).filter(event => event.kind === 'continuation')).toHaveLength(1);
  });

  it('dispatches no wake when continuation persistence fails and resumes after storage recovery', async () => {
    const memory = await setup([question('reply-a', 100)]);
    const harness = createHarness(memory);
    const store = await memory.storage.getStore('memory');
    const originalSave = store!.saveMessages.bind(store);
    const save = vi.spyOn(store!, 'saveMessages').mockImplementationOnce(async args => {
      if (getRemindProtocol(args.messages[0]!)?.kind === 'continuation') throw new Error('storage unavailable');
      return originalSave(args);
    });

    await harness.processor.processOutputResult(resultArgs());
    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(
      (await reconstructRemindContinuationView({ memory, threadId: reminderThreadId, resourceId })).outstanding.get(
        'reply-a',
      )?.attempts,
    ).toBe(0);

    save.mockRestore();
    const recovered = createHarness(memory);
    await recovered.processor.processOutputResult(resultArgs());
    expect(recovered.sendMessage).toHaveBeenCalledOnce();
  });

  it('preserves a successful pending answer when continuation exhaustion retries its delivery', async () => {
    const replyId = 'reply-a';
    const memory = await setup([
      question(replyId, 100),
      {
        kind: 'terminal-pending-delivery',
        ...base(`${replyId}:terminal:pending`, 300),
        replyId,
        outcome: 'answer',
      },
    ]);
    const store = await memory.storage.getStore('memory');
    const pending = (await store!.listMessagesById({ messageIds: [`${replyId}:terminal:pending`] })).messages[0]!;
    pending.content.parts = [
      { type: 'text', text: `Terminal reply pending delivery for ${replyId}\n\nThe original answer.` },
    ];
    await memory.saveMessages({ messages: [pending] });
    const harness = createHarness(memory);

    await harness.processor.processOutputResult(
      resultArgs({ result: { text: '', usage: {}, finishReason: 'error', steps: [] } }),
    );

    expect(harness.parentSignals).toEqual([
      expect.objectContaining({
        contents: 'The original answer.',
        attributes: expect.objectContaining({ outcome: 'answer' }),
      }),
    ]);
    expect(await protocols(memory)).toContainEqual(
      expect.objectContaining({ kind: 'terminal-delivered', replyId, outcome: 'answer' }),
    );
  });
});
