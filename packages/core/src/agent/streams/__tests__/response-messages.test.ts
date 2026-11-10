import { describe, expect, it } from 'vitest';
import { applyResponseMessages, diffResponseMessages, replayResponseMessages } from '../response-messages';
import type { ResponseMessagesCursor, ResponseMessagesDiff, ResponseMessagesReplay } from '../response-messages';

const assistant = (text: string) => ({ role: 'assistant' as const, content: [{ type: 'text' as const, text }] });
const tool = (id: string) => ({
  role: 'tool' as const,
  content: [{ type: 'tool-result' as const, toolCallId: id, toolName: 'lookup', output: { type: 'text', value: id } }],
});

/** Publishes `lists` (the run's response messages at each step-finish) as a producer would. */
function publish(lists: any[][]): ResponseMessagesDiff[] {
  let cursor: ResponseMessagesCursor | undefined;
  return lists.map(list => {
    const result = diffResponseMessages(cursor, list);
    cursor = result.cursor;
    return result.diff;
  });
}

const read = (replay: ResponseMessagesReplay, diff: ResponseMessagesDiff) =>
  applyResponseMessages(replay, { _durableResponseMessagesDiff: diff });

describe('response message diffs', () => {
  const steps = [
    [assistant('a1'), tool('t1')],
    [assistant('a1'), tool('t1'), assistant('a2'), tool('t2')],
    // The step's assistant message grew and a message was appended.
    [assistant('a1'), tool('t1'), assistant('a2 edited'), tool('t2'), assistant('a3')],
    // A retried attempt was rolled back: the list got shorter.
    [assistant('a1'), tool('t1')],
    [assistant('a1'), tool('t1')],
  ];

  it('sends each message once and rebuilds every step list', () => {
    const diffs = publish(steps);
    expect(diffs.map(diff => [diff.from, diff.messages.length])).toEqual([
      [0, 2],
      [2, 2],
      [2, 3],
      [2, 0],
      [2, 0],
    ]);
    const replay: ResponseMessagesReplay = { messages: [] };
    expect(diffs.map(diff => read(replay, diff))).toEqual(steps);
  });

  it('ignores a step-finish delivered twice', () => {
    const [first, second, third] = publish(steps);
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, first!);
    read(replay, second!);
    expect(read(replay, second!)).toEqual(steps[1]);
    expect(read(replay, third!)).toEqual(steps[2]);
  });

  it('reports nothing after a missed diff until the next full list', () => {
    const diffs = publish(steps);
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, diffs[0]!);
    // diffs[1] is lost, so diffs[2] can't be placed, nor can anything after it.
    expect(read(replay, diffs[2]!)).toBeUndefined();
    expect(read(replay, diffs[3]!)).toBeUndefined();
    // A resumed run's new producer starts over with the full list.
    const [restart] = publish([steps[4]!]);
    expect(read(replay, restart!)).toEqual(steps[4]);
  });

  it('treats full lists from older producers as the whole list', () => {
    const replay: ResponseMessagesReplay = { messages: [] };
    expect(applyResponseMessages(replay, { _durableResponseMessages: steps[1] })).toEqual(steps[1]);
    expect(applyResponseMessages(replay, {})).toBeUndefined();
  });

  it('rebuilds the list a reader starting mid-log skipped', () => {
    const diffs = publish(steps.slice(0, 3));
    const events = diffs.map(diff => ({
      type: 'chunk',
      data: { type: 'step-finish', payload: { _durableResponseMessagesDiff: diff } },
    }));
    const replay = replayResponseMessages(events.slice(0, 2));
    expect(read(replay, diffs[2]!)).toEqual(steps[2]);
  });
});
