import { describe, expect, it } from 'vitest';
import {
  applyResponseMessages,
  diffResponseMessages,
  replayResponseMessages,
  RESPONSE_MESSAGES_FULL_LIST_INTERVAL,
} from '../response-messages';
import type { ResponseMessagesCursor, ResponseMessagesDiff, ResponseMessagesReplay } from '../response-messages';

const assistant = (text: string) => ({ role: 'assistant' as const, content: [{ type: 'text' as const, text }] });
const tool = (id: string) => ({
  role: 'tool' as const,
  content: [{ type: 'tool-result' as const, toolCallId: id, toolName: 'lookup', output: { type: 'text', value: id } }],
});

/** Publishes `lists` (the run's response messages at each step-finish) as one producer would. */
function publish(lists: any[][], producer = 'segment-1'): ResponseMessagesDiff[] {
  let cursor: ResponseMessagesCursor | { producer: string } = { producer };
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

  it('resends the whole list at a fixed interval', () => {
    const lists = Array.from({ length: RESPONSE_MESSAGES_FULL_LIST_INTERVAL * 2 + 1 }, (_, i) =>
      Array.from({ length: i + 1 }, (_, j) => assistant(`a${j}`)),
    );
    const fullLists = publish(lists).flatMap((diff, i) => (diff.from === 0 ? [i] : []));
    expect(fullLists).toEqual([0, RESPONSE_MESSAGES_FULL_LIST_INTERVAL, RESPONSE_MESSAGES_FULL_LIST_INTERVAL * 2]);
  });

  it('ignores a step-finish delivered twice or late', () => {
    const [first, second, third] = publish(steps);
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, first!);
    read(replay, second!);
    expect(read(replay, second!)).toBeUndefined();
    expect(read(replay, first!)).toBeUndefined();
    expect(read(replay, third!)).toEqual(steps[2]);
  });

  it('reports nothing after a missed diff until the next whole list', () => {
    const lists = Array.from({ length: RESPONSE_MESSAGES_FULL_LIST_INTERVAL + 1 }, (_, i) =>
      Array.from({ length: i + 1 }, (_, j) => assistant(`a${j}`)),
    );
    const diffs = publish(lists);
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, diffs[0]!);
    // diffs[1] is lost, so nothing until the producer's next whole list can be placed.
    for (const diff of diffs.slice(2, -1)) expect(read(replay, diff)).toBeUndefined();
    expect(read(replay, diffs.at(-1)!)).toEqual(lists.at(-1));
  });

  it('never applies a diff to another producer’s list', () => {
    const first = publish(steps, 'segment-1');
    const second = publish([steps[1]!, steps[2]!], 'segment-2');
    const replay: ResponseMessagesReplay = { messages: [] };
    for (const diff of first.slice(0, 4)) read(replay, diff);
    // The resumed segment's whole list was missed: its next diff can't be placed.
    expect(read(replay, second[1]!)).toBeUndefined();
    // A late copy of the first segment's whole list doesn't let the next segment's diffs land on it.
    expect(read(replay, first[0]!)).toBeUndefined();
    expect(read(replay, second[1]!)).toBeUndefined();
    expect(read(replay, second[0]!)).toEqual(steps[1]);
    expect(read(replay, second[1]!)).toEqual(steps[2]);
  });

  it('treats whole lists from producers that send no diffs as the list', () => {
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
