import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { TokenCounter } from '../token-counter';

const MARK = 'perf29851';

function toolPart(i: number): any {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: `call-${i}`,
      toolName: 'read_file',
      args: { path: `file-${i}` },
      result: { [MARK]: true, payload: 'stable tool payload '.repeat(180) },
    },
  };
}

function assistant(parts: any[]): MastraDBMessage {
  return {
    id: 'assistant',
    role: 'assistant',
    threadId: 't',
    resourceId: 'r',
    createdAt: new Date('2026-01-01'),
    content: { format: 2, parts },
  };
}

/** Counts JSON.stringify calls (and characters) on marked tool-result objects only. */
function spyOnResultSerialization() {
  const original = JSON.stringify;
  const counts = { calls: 0, chars: 0 };
  const spy = vi.spyOn(JSON, 'stringify').mockImplementation(((value: any, ...rest: any[]) => {
    const text = (original as any)(value, ...rest);
    if (value && typeof value === 'object' && value[MARK] === true) {
      counts.calls++;
      counts.chars += text.length;
    }
    return text;
  }) as typeof JSON.stringify);
  return { counts, spy };
}

async function setup(observation: Record<string, unknown> = {}) {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: 't', resourceId: 'r', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
  });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: {
      model: 'test-model',
      messageTokens: 1_000_000_000,
      bufferTokens: false,
      bufferOnIdle: false,
      ...observation,
    },
    reflection: { model: 'test-model', observationTokens: 1_000_000_000 },
  });
  const messageList = new MessageList({ threadId: 't', resourceId: 'r' });
  messageList.add(
    {
      id: 'user',
      role: 'user',
      threadId: 't',
      resourceId: 'r',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'inspect all files' }] },
    },
    'input',
  );
  const turn = om.beginTurn({ threadId: 't', resourceId: 'r', messageList });
  await turn.start();
  await turn.step(0).prepare();
  return { om, turn, messageList };
}

describe('OM token counting work in long tool runs (#29851)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes a warmed, unchanged plain JSON tool result at most once per count', async () => {
    const counter = new TokenCounter();
    const message = assistant([toolPart(1)]);
    const expected = await counter.countMessageAsync(message);

    const { counts, spy } = spyOnResultSerialization();
    const actual = await counter.countMessageAsync(message);
    spy.mockRestore();

    expect(actual).toBe(expected);
    // Plain JSON results must not pay an extra full serialization just to rule out multimodal content.
    expect(counts.calls).toBeLessThan(2);
  });

  it('keeps sync and async counts equal, and warm counts equal to fresh counts', async () => {
    const counter = new TokenCounter();
    const message = assistant([toolPart(1), toolPart(2)]);
    const asyncCount = await counter.countMessageAsync(message);
    expect(counter.countMessage(message)).toBe(asyncCount);
    expect(await counter.countMessageAsync(message)).toBe(asyncCount);

    const fresh = JSON.parse(JSON.stringify(message));
    for (const part of fresh.content.parts) delete part.providerMetadata;
    expect(await new TokenCounter().countMessageAsync(fresh)).toBe(asyncCount);
  });

  it('still recounts nested result, args, and modelOutput edits on the same objects', async () => {
    const counter = new TokenCounter();
    const part = toolPart(1);
    const message = assistant([part]);
    const initial = await counter.countMessageAsync(message);

    part.toolInvocation.result.payload = 'changed data '.repeat(900);
    const nested = await counter.countMessageAsync(message);
    expect(nested).not.toBe(initial);

    part.toolInvocation.args.path = 'changed argument '.repeat(600);
    const args = await counter.countMessageAsync(message);
    expect(args).not.toBe(nested);

    part.providerMetadata.mastra.modelOutput = { type: 'text', value: 'model-facing short output' };
    const mapped = await counter.countMessageAsync(message);
    expect(mapped).not.toBe(args);

    part.providerMetadata.mastra.modelOutput.value = 'model-facing different output '.repeat(800);
    const changedMapped = await counter.countMessageAsync(message);
    expect(changedMapped).not.toBe(mapped);

    const fresh = JSON.parse(JSON.stringify(message));
    delete fresh.content.parts[0].providerMetadata.mastra.tokenEstimate;
    expect(await new TokenCounter().countMessageAsync(fresh)).toBe(changedMapped);
  });

  it('still counts image content in tool results as an attachment, and recounts when it changes', async () => {
    const counter = new TokenCounter();
    const part = toolPart(1);
    part.toolInvocation.result = {
      type: 'content',
      value: [
        { type: 'text', text: 'screenshot' },
        { type: 'media', mediaType: 'image/png', data: 'iVBORw0KGgo'.repeat(10) },
      ],
    };
    const message = assistant([part]);
    const withImage = await counter.countMessageAsync(message);

    const textOnly = assistant([
      {
        ...toolPart(1),
        toolInvocation: {
          ...toolPart(1).toolInvocation,
          result: { type: 'content', value: [{ type: 'text', text: 'screenshot' }] },
        },
      },
    ]);
    expect(withImage).not.toBe(await new TokenCounter().countMessageAsync(textOnly));

    part.toolInvocation.result.value[1].data = 'iVBORw0KGgo'.repeat(4000);
    const fresh = JSON.parse(JSON.stringify(message));
    delete fresh.content.parts[0].providerMetadata;
    expect(await counter.countMessageAsync(message)).toBe(await new TokenCounter().countMessageAsync(fresh));
  });

  it('refreshes status when a background tool result lands while the step saves', async () => {
    const f = await setup();
    f.messageList.add({ ...assistant([{ type: 'text', text: 'first result' }]), id: 'assistant' }, 'response');
    const persist = f.om.persistMessages.bind(f.om);
    let inserted = false;
    vi.spyOn(f.om, 'persistMessages').mockImplementation(async (...args) => {
      await persist(...args);
      if (inserted) return;
      inserted = true;
      f.messageList.add(
        {
          id: 'background',
          role: 'assistant',
          threadId: 't',
          resourceId: 'r',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'background',
                  toolName: 'read_file',
                  args: {},
                  result: 'new data '.repeat(5000),
                },
              },
            ],
          },
        },
        'response',
      );
    });

    const context = await f.turn.step(1).prepare();
    const current = await f.om.getStatus({
      threadId: 't',
      resourceId: 'r',
      record: f.turn.record,
      messages: f.messageList.get.all.db(),
    });

    expect(inserted).toBe(true);
    expect(context.observed).toBe(false);
    expect(context.buffered).toBe(false);
    expect(context.status.pendingTokens).toBe(current.pendingTokens);
  });

  it('refreshes status when a pending tool call resolves in place while the step saves', async () => {
    const f = await setup();
    const call = toolPart(1);
    call.toolInvocation = { state: 'call', toolCallId: 'call-1', toolName: 'read_file', args: { path: 'file-1' } };
    f.messageList.add(assistant([call]), 'response');
    const persist = f.om.persistMessages.bind(f.om);
    let resolved = false;
    vi.spyOn(f.om, 'persistMessages').mockImplementation(async (...args) => {
      await persist(...args);
      if (resolved) return;
      resolved = f.messageList.updateToolInvocation({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-1',
          toolName: 'read_file',
          args: { path: 'file-1' },
          result: 'resolved data '.repeat(5000),
        },
      });
    });

    const context = await f.turn.step(1).prepare();
    const current = await f.om.getStatus({
      threadId: 't',
      resourceId: 'r',
      record: f.turn.record,
      messages: f.messageList.get.all.db(),
    });

    expect(resolved).toBe(true);
    expect(context.status.pendingTokens).toBe(current.pendingTokens);
  });

  it('refreshes status when a result is edited in place while the step saves', async () => {
    const f = await setup();
    f.messageList.add(
      assistant([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'x',
            toolName: 'read_file',
            args: {},
            result: { payload: 'small' },
          },
        },
      ]),
      'response',
    );
    const part: any = f.messageList.get.all
      .db()
      .find(m => m.id === 'assistant')!
      .content.parts.find(p => p.type === 'tool-invocation');
    const result = part.toolInvocation.result;
    const persist = f.om.persistMessages.bind(f.om);
    let edited = false;
    vi.spyOn(f.om, 'persistMessages').mockImplementation(async (...args) => {
      await persist(...args);
      result.payload = 'new data '.repeat(5000);
      edited = true;
    });

    const context = await f.turn.step(1).prepare();
    const current = await f.om.getStatus({
      threadId: 't',
      resourceId: 'r',
      record: f.turn.record,
      messages: f.messageList.get.all.db(),
    });

    expect(edited).toBe(true);
    expect(part.toolInvocation.result).toBe(result);
    expect(context.status.pendingTokens).toBe(current.pendingTokens);
  });

  it('still refreshes status after a step that started buffering', async () => {
    const f = await setup({ messageTokens: 100_000, bufferTokens: 500, bufferActivation: 0.5 });
    f.messageList.add(assistant([toolPart(1)]), 'response');
    vi.spyOn(f.om, 'buffer').mockResolvedValue(undefined as any);
    const spy = vi.spyOn(f.om, 'getStatus');

    const context = await f.turn.step(1).prepare();

    expect(context.buffered).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('serializes each prior tool result at most twice per step as a long tool run grows', async () => {
    const f = await setup();
    const observe = vi.spyOn(f.om, 'observe');
    const { counts, spy } = spyOnResultSerialization();
    const perStep: Record<number, number> = {};
    try {
      for (let i = 1; i <= 100; i++) {
        f.messageList.add(assistant([toolPart(i)]), 'response');
        counts.calls = 0;
        await f.turn.step(i).prepare();
        perStep[i] = counts.calls;
      }
    } finally {
      spy.mockRestore();
    }

    expect(observe).not.toHaveBeenCalled();
    // Main serialized every accumulated result four times per step: two getStatus passes, each
    // serializing plain JSON results twice. Each pass now serializes them once. Both passes stay:
    // the second one picks up anything that changed while the step saved.
    expect(perStep[100]).toBeLessThanOrEqual(200);
    expect(perStep[10]).toBeLessThanOrEqual(20);
  });
});
