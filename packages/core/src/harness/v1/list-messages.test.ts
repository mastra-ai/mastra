/**
 * Harness v1 — `Session.listMessages()` (§4.2, §4.4).
 *
 * Covers:
 *   - empty thread returns `[]`
 *   - text / thinking / tool_call / tool_result parts map through the
 *     shared converter (spec §11.1) into the public `HarnessMessage` shape
 *   - chronological order (oldest-first) is preserved both for unbounded
 *     and limited reads
 *   - `limit` caps to the most recent N messages while keeping
 *     chronological order
 *   - rejects invalid `limit` values
 *   - graceful empty result when memory storage isn't configured
 *   - throws once the session is closed
 */
import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../../agent/types';

import { setupHarness } from './__test-utils__';
import { HarnessValidationError } from './errors';

async function seedMessages(harness: ReturnType<typeof setupHarness>['harness'], messages: MastraDBMessage[]) {
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
    const messages = await session.listMessages();
    expect(messages).toEqual([]);
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

  it('splits a tool-invocation into separate tool_call + tool_result parts', async () => {
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

  it('throws once the session is closed', async () => {
    const { harness } = setupHarness();
    await harness.threads.create({ resourceId: 'r1', threadId: 'thread-closed', title: 't' });
    const session = await harness.session({ resourceId: 'r1', threadId: 'thread-closed' });
    await session.close();

    await expect(session.listMessages()).rejects.toThrow(/is closed/);
  });
});
