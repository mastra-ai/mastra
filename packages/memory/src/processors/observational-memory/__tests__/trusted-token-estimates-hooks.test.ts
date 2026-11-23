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

  it('an in-place edit with no return is counted fresh', async () => {
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

  it('the hook gets the original messages, as before, and edits to them are recounted', async () => {
    const msg = counted();
    let seen: MastraDBMessage[] = [];
    const result = await applyBeforeObservation(
      {
        beforeObservation: ({ messages }) => {
          seen = messages;
        },
      },
      [msg],
      context,
    );
    expect(seen[0]).toBe(msg);
    expect(hasTrusted(result[0]!.content.parts[0])).toBe(false);
  });

  it('a hook that only reads leaves the originals with no trusted count', async () => {
    const msg = counted();
    await applyBeforeObservation({ beforeObservation: () => undefined }, [msg], context);
    expect(hasTrusted(msg.content.parts[0])).toBe(false);
  });
});
