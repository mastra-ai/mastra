import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';
import { applyBeforeObservation } from '../transform-hooks';

const context = {} as never;
const longText = 'The quarterly plan covers hiring and budget across every team. '.repeat(20);

function message(parts: any[], id = 'm1'): MastraDBMessage {
  return { id, role: 'user', createdAt: new Date(0), content: { format: 2, parts } };
}

function hasTrusted(part: any): boolean {
  const estimate = part?.providerMetadata?.mastra?.tokenEstimate;
  if (!estimate) return false;
  return ('source' in estimate ? [estimate] : Object.values(estimate)).some((entry: any) => entry?.v === 9);
}

function counted(): MastraDBMessage {
  const msg = message([{ type: 'text', text: longText }]);
  new TokenCounter().countMessage(msg);
  expect(hasTrusted(msg.content.parts[0])).toBe(true);
  return msg;
}

const freshCount = (text: string) => new TokenCounter().countMessage(message([{ type: 'text', text }], 'fresh'));

describe('beforeObservation and trusted token counts', () => {
  it('with no hook, the same messages come back with their counts', async () => {
    const msg = counted();
    const result = await applyBeforeObservation(undefined, [msg], context);
    expect(result[0]).toBe(msg);
    expect(hasTrusted(msg.content.parts[0])).toBe(true);
  });

  it('an in-place edit with no return is counted fresh and leaves the original as it was', async () => {
    const msg = counted();
    const result = await applyBeforeObservation(
      {
        beforeObservation: ({ messages }) => {
          (messages[0]!.content.parts[0] as { text: string }).text = 'redacted';
        },
      },
      [msg],
      context,
    );
    expect((msg.content.parts[0] as { text: string }).text).toBe(longText);
    expect(new TokenCounter().countMessage(result[0]!)).toBe(freshCount('redacted'));
  });

  it('a returned spread that carries the old count is counted fresh', async () => {
    const msg = counted();
    const result = await applyBeforeObservation(
      {
        beforeObservation: ({ messages }) => ({
          messages: messages.map(m => ({
            ...m,
            content: { ...m.content, parts: m.content.parts.map(p => ({ ...p, text: 'short' })) },
          })) as MastraDBMessage[],
        }),
      },
      [msg],
      context,
    );
    expect(new TokenCounter().countMessage(result[0]!)).toBe(freshCount('short'));
  });

  it('the hook gets plain copies, and Buffers stay Buffers', async () => {
    const bytes = Buffer.from('secret image bytes');
    const msg = message([
      { type: 'file', data: bytes, mimeType: 'image/png' },
      { type: 'text', text: longText },
    ]);
    let seen: MastraDBMessage[] = [];
    await applyBeforeObservation(
      {
        beforeObservation: ({ messages }) => {
          seen = messages;
          const file = messages[0]!.content.parts[0] as { data: Buffer };
          expect(Buffer.isBuffer(file.data)).toBe(true);
          file.data[0] = 0;
          expect(() => structuredClone(messages)).not.toThrow();
        },
      },
      [msg],
      context,
    );
    expect(seen[0]).not.toBe(msg);
    expect((msg.content.parts[0] as { data: Buffer }).data.toString()).toBe('secret image bytes');
  });

  it('a hook that only reads leaves the originals with no trusted count', async () => {
    const msg = counted();
    await applyBeforeObservation({ beforeObservation: () => undefined }, [msg], context);
    expect(hasTrusted(msg.content.parts[0])).toBe(false);
  });

  it('a value it cannot copy is passed by reference without throwing', async () => {
    const map = new Map([['k', 1]]);
    const msg = message([
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId: 'c', toolName: 't', args: {}, result: { map } },
      },
    ]);
    let received: unknown;
    await applyBeforeObservation(
      {
        beforeObservation: ({ messages }) => {
          received = (messages[0]!.content.parts[0] as any).toolInvocation.result.map;
        },
      },
      [msg],
      context,
    );
    expect(received).toBe(map);
  });
});
