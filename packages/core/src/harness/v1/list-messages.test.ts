/**
 * Harness v1 — `Session.listMessages()` (§4.2, §4.4).
 *
 * Ported from the fork to pin status-quo history readback semantics:
 * memory rows map through the shared `HarnessMessage` converter,
 * unlimited reads stay chronological, limited reads return the most recent N
 * messages in chronological order, invalid limits reject, and closed sessions
 * stop serving history.
 */
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { createSignal } from '../../agent/signals';
import type { MastraDBMessage } from '../../agent/types';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { HarnessValidationError } from './errors';
import { Harness } from './harness';

function makeAgent(name = 'default') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function setupHarness() {
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: makeAgent() },
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, storage };
}

async function seedMessages(harness: Harness, messages: MastraDBMessage[]) {
  const memory = await harness._internalTryGetMemoryStorage();
  if (!memory) throw new Error('test setup expected memory storage');
  await memory.saveMessages({ messages });
}

function makeUserMessage(
  id: string,
  threadId: string,
  resourceId: string,
  text: string,
  createdAt: Date,
): MastraDBMessage {
  return {
    id,
    role: 'user',
    threadId,
    resourceId,
    createdAt,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
  } as MastraDBMessage;
}

function makeAssistantWithToolCall(
  id: string,
  threadId: string,
  resourceId: string,
  text: string,
  toolCallId: string,
  toolName: string,
  args: unknown,
  result: unknown,
  createdAt: Date,
): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    threadId,
    resourceId,
    createdAt,
    content: {
      format: 2,
      parts: [
        { type: 'text', text },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId,
            toolName,
            args,
            result,
          },
        },
      ],
    },
  } as MastraDBMessage;
}

describe('Session.listMessages', () => {
  it('returns [] when the thread has no messages', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-empty', title: 't' });

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-empty' });
    await expect(session.listMessages()).resolves.toEqual([]);
  });

  it('maps text content into the HarnessMessage partition', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-text', title: 't' });
    await seedMessages(harness, [
      makeUserMessage('m1', 'thread-text', 'r1', 'hello', new Date('2026-05-10T00:00:00Z')),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-text' });
    const messages = await session.listMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 'm1',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('splits a tool-invocation into separate tool_call and tool_result parts', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-tools', title: 't' });
    await seedMessages(harness, [
      makeAssistantWithToolCall(
        'm1',
        'thread-tools',
        'r1',
        'thinking...',
        'tc-1',
        'echo',
        { value: 'hi' },
        { ok: true, echoed: 'hi' },
        new Date('2026-05-10T00:00:01Z'),
      ),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-tools' });
    const [msg] = await session.listMessages();

    expect(msg!.role).toBe('assistant');
    expect(msg!.content).toEqual([
      { type: 'text', text: 'thinking...' },
      { type: 'tool_call', id: 'tc-1', name: 'echo', args: { value: 'hi' } },
      { type: 'tool_result', id: 'tc-1', name: 'echo', result: { ok: true, echoed: 'hi' }, isError: false },
    ]);
  });

  it('preserves completed tool invocations when the result payload is omitted', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-undefined-tool-result', title: 't' });
    await seedMessages(harness, [
      {
        id: 'm1',
        role: 'assistant',
        threadId: 'thread-undefined-tool-result',
        resourceId: 'r1',
        createdAt: new Date('2026-05-10T00:00:01Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tc-undefined',
                toolName: 'noop',
                args: {},
              },
            },
          ],
        },
      } as MastraDBMessage,
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-undefined-tool-result' });
    const [msg] = await session.listMessages();

    expect(msg!.content).toEqual([
      { type: 'tool_call', id: 'tc-undefined', name: 'noop', args: {} },
      { type: 'tool_result', id: 'tc-undefined', name: 'noop', result: undefined, isError: false },
    ]);
  });

  it('normalizes persisted user-message signal rows to user messages', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-user-signal', title: 't' });
    await seedMessages(harness, [
      createSignal({
        id: 'sig-user',
        type: 'user-message',
        contents: 'from signal',
        createdAt: '2026-05-10T00:00:02Z',
      }).toDBMessage({ threadId: 'thread-user-signal', resourceId: 'r1' }),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-user-signal' });
    const [msg] = await session.listMessages();

    expect(msg).toMatchObject({
      id: 'sig-user',
      role: 'user',
      content: [{ type: 'text', text: 'from signal' }],
    });
  });

  it('maps persisted system-reminder signal rows to system_reminder parts', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-reminder-signal', title: 't' });
    await seedMessages(harness, [
      createSignal({
        id: 'sig-reminder',
        type: 'system-reminder',
        contents: 'remember this',
        attributes: {
          type: 'goal',
          path: 'goal.judge',
          gapText: 'after a while',
          gapMs: 123,
          timestamp: '2026-05-10T00:00:02Z',
        },
        metadata: { goalMaxTurns: 3, judgeModelId: 'judge-model' },
        createdAt: '2026-05-10T00:00:02Z',
      }).toDBMessage({ threadId: 'thread-reminder-signal', resourceId: 'r1' }),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-reminder-signal' });
    const [msg] = await session.listMessages();

    expect(msg).toMatchObject({
      id: 'sig-reminder',
      role: 'user',
      content: [
        {
          type: 'system_reminder',
          message: 'remember this',
          reminderType: 'goal',
          path: 'goal.judge',
          gapText: 'after a while',
          gapMs: 123,
          timestamp: '2026-05-10T00:00:02Z',
          goalMaxTurns: 3,
          judgeModelId: 'judge-model',
        },
      ],
    });
  });

  it('maps data-system-reminder parts that carry contents and attributes', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-reminder-part', title: 't' });
    const reminderPart = createSignal({
      id: 'sig-part',
      type: 'system-reminder',
      contents: 'part reminder',
      attributes: { type: 'time-gap', path: 'history', gapMs: 456 },
      createdAt: '2026-05-10T00:00:03Z',
    }).toDataPart();
    await seedMessages(harness, [
      {
        id: 'm-reminder-part',
        role: 'assistant',
        threadId: 'thread-reminder-part',
        resourceId: 'r1',
        createdAt: new Date('2026-05-10T00:00:03Z'),
        content: {
          format: 2,
          parts: [reminderPart],
        },
      } as MastraDBMessage,
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-reminder-part' });
    const [msg] = await session.listMessages();

    expect(msg!.content).toEqual([
      {
        type: 'system_reminder',
        message: 'part reminder',
        reminderType: 'time-gap',
        path: 'history',
        gapMs: 456,
      },
    ]);
  });

  it('returns messages oldest-first', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-order', title: 't' });
    await seedMessages(harness, [
      makeUserMessage('m1', 'thread-order', 'r1', 'first', new Date('2026-05-10T00:00:00Z')),
      makeUserMessage('m2', 'thread-order', 'r1', 'second', new Date('2026-05-10T00:00:10Z')),
      makeUserMessage('m3', 'thread-order', 'r1', 'third', new Date('2026-05-10T00:00:20Z')),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-order' });
    const messages = await session.listMessages();
    expect(messages.map(m => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('scopes reads by the session resource when thread ids collide', async () => {
    const { harness } = setupHarness();
    await seedMessages(harness, [
      makeUserMessage('m-r1', 'shared-thread', 'r1', 'resource one', new Date('2026-05-10T00:00:00Z')),
      makeUserMessage('m-r2', 'shared-thread', 'r2', 'resource two', new Date('2026-05-10T00:00:10Z')),
    ]);

    const session = await harness.session({ resourceId: 'r2', threadId: 'shared-thread' });
    const messages = await session.listMessages();

    expect(messages.map(m => m.id)).toEqual(['m-r2']);
    expect(messages[0]?.content).toEqual([{ type: 'text', text: 'resource two' }]);
  });

  it('limit caps to the most recent N messages, still oldest-first', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-limit', title: 't' });
    await seedMessages(harness, [
      makeUserMessage('m1', 'thread-limit', 'r1', 'first', new Date('2026-05-10T00:00:00Z')),
      makeUserMessage('m2', 'thread-limit', 'r1', 'second', new Date('2026-05-10T00:00:10Z')),
      makeUserMessage('m3', 'thread-limit', 'r1', 'third', new Date('2026-05-10T00:00:20Z')),
      makeUserMessage('m4', 'thread-limit', 'r1', 'fourth', new Date('2026-05-10T00:00:30Z')),
    ]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-limit' });
    const messages = await session.listMessages({ limit: 2 });
    expect(messages.map(m => m.id)).toEqual(['m3', 'm4']);
  });

  it('limit === 0 returns []', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-zero', title: 't' });
    await seedMessages(harness, [makeUserMessage('m1', 'thread-zero', 'r1', 'hi', new Date('2026-05-10T00:00:00Z'))]);

    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-zero' });
    expect(await session.listMessages({ limit: 0 })).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid limit (%s)', async (bad: number) => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-bad', title: 't' });
    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-bad' });

    await expect(session.listMessages({ limit: bad })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('returns [] when memory storage is not configured', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-no-memory' });

    await expect(session.listMessages()).resolves.toEqual([]);
  });

  it('still validates limit when memory storage is not configured', async () => {
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-no-memory' });

    await expect(session.listMessages({ limit: -1 })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('throws once the session is closed', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-closed', title: 't' });
    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-closed' });
    await session.close();

    await expect(session.listMessages()).rejects.toThrow(/is closed/);
  });
});
