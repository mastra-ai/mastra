import { describe, expect, it } from 'vitest';
import { applyResponseMessages, diffResponseMessages, replayResponseMessages } from '../response-messages';
import type { ResponseMessagesCursor, ResponseMessagesDiff, ResponseMessagesReplay } from '../response-messages';

const assistant = (text: string) => ({ role: 'assistant' as const, content: [{ type: 'text' as const, text }] });
const tool = (id: string) => ({
  role: 'tool' as const,
  content: [{ type: 'tool-result' as const, toolCallId: id, toolName: 'lookup', output: { type: 'text', value: id } }],
});
/** A first message large enough that the next few diffs don't add up to a whole list. */
const opening = assistant('x'.repeat(400));

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

/** Lists that grow by one same-size message per step. */
const growing = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    Array.from({ length: i + 1 }, (_, j) => assistant(`a${String(j).padStart(3, '0')}`)),
  );

describe('response message diffs', () => {
  const steps = [
    [opening, assistant('a1'), tool('t1')],
    [opening, assistant('a1'), tool('t1'), assistant('a2'), tool('t2')],
    // The step's assistant message grew and a message was appended.
    [opening, assistant('a1'), tool('t1'), assistant('a2 edited'), tool('t2'), assistant('a3')],
    // A retried attempt was rolled back: the list got shorter.
    [opening, assistant('a1'), tool('t1')],
    [opening, assistant('a1'), tool('t1')],
  ];

  it('sends each message once and rebuilds every step list', () => {
    const diffs = publish(steps);
    expect(diffs.map(diff => [diff.from, diff.messages.length])).toEqual([
      [0, 3],
      [3, 2],
      [3, 3],
      [3, 0],
      [3, 0],
    ]);
    const replay: ResponseMessagesReplay = { messages: [] };
    expect(diffs.map(diff => read(replay, diff))).toEqual(steps);
  });

  it('resends the whole list once the diffs since the last one add up to its size', () => {
    const diffs = publish(growing(20));
    expect(diffs.flatMap((diff, i) => (diff.from === 0 ? [i] : []))).toEqual([0, 2, 6, 14]);
    // Whole lists cost about as much as the diffs, so the total stays proportional to the run.
    const wholeListMessages = diffs.filter(diff => diff.from === 0).reduce((n, diff) => n + diff.messages.length, 0);
    const diffMessages = diffs.filter(diff => diff.from > 0).reduce((n, diff) => n + diff.messages.length, 0);
    expect(wholeListMessages).toBeLessThanOrEqual(diffMessages + 20);
  });

  it('reports a step-finish delivered twice and ignores a late one', () => {
    const [first, second, third] = publish(steps);
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, first!);
    read(replay, second!);
    expect(read(replay, second!)).toEqual(steps[1]);
    expect(read(replay, first!)).toBeUndefined();
    expect(read(replay, third!)).toEqual(steps[2]);
  });

  it('never applies a diff made against a list the reader does not hold', () => {
    // A step published twice with different content (the predicate ran again after a crash):
    // later diffs are made against the second version.
    let cursor: ResponseMessagesCursor | { producer: string } = { producer: 'execution-1' };
    const first = diffResponseMessages(cursor, steps[0]!);
    cursor = first.cursor;
    const stepTwo = diffResponseMessages(cursor, steps[1]!);
    const retried = [opening, assistant('a1'), tool('t1'), assistant('other')];
    const stepTwoAgain = diffResponseMessages(cursor, retried);
    const stepThree = diffResponseMessages(stepTwoAgain.cursor, [...retried, assistant('x')]);
    expect(stepThree.diff.from).toBe(4);

    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, first.diff);
    read(replay, stepTwo.diff);
    expect(read(replay, stepTwoAgain.diff)).toBeUndefined();
    expect(read(replay, stepThree.diff)).toBeUndefined();
    expect(replay.messages).toEqual(steps[1]);
  });

  it('reports nothing after a missed diff until the next whole list', () => {
    const lists = growing(7);
    const diffs = publish(lists);
    const replay: ResponseMessagesReplay = { messages: [] };
    for (const diff of diffs.slice(0, 3)) read(replay, diff);
    // diffs[3] is lost, so nothing until the producer's next whole list (diffs[6]) can be placed.
    expect(read(replay, diffs[4]!)).toBeUndefined();
    expect(read(replay, diffs[5]!)).toBeUndefined();
    expect(diffs[6]!.from).toBe(0);
    expect(read(replay, diffs[6]!)).toEqual(lists[6]);
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

  it('keeps a resumed producer’s list when the previous producer’s whole list lands late', () => {
    const before = publish([steps[0]!, steps[1]!], 'segment-1');
    const resumed = publish([steps[1]!, steps[2]!], 'segment-2');
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, before[0]!);
    expect(read(replay, resumed[0]!)).toEqual(steps[1]);
    // The previous segment was still publishing when the run resumed.
    expect(read(replay, before[1]!)).toEqual(steps[1]);
    expect(read(replay, { ...before[0]!, seq: 2 })).toEqual(steps[0]);
    expect(resumed[1]!.from).toBeGreaterThan(0);
    expect(read(replay, resumed[1]!)).toEqual(steps[2]);
  });

  it('keeps the current producer’s list when late events of older producers arrive after two resumes', () => {
    const [a] = publish([steps[0]!], 'segment-1');
    const [b] = publish([steps[1]!], 'segment-2');
    const current = publish([steps[1]!, steps[2]!], 'segment-3');
    const replay: ResponseMessagesReplay = { messages: [] };
    read(replay, a!);
    read(replay, b!);
    read(replay, current[0]!);
    // The first segment's list was dropped for the third; its late whole lists still report.
    expect(read(replay, { ...a!, seq: 1 })).toEqual(steps[0]);
    expect(read(replay, { ...b!, seq: 1 })).toEqual(steps[1]);
    expect(read(replay, current[1]!)).toEqual(steps[2]);
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
    expect(diffs[2]!.from).toBeGreaterThan(0);
    expect(read(replay, diffs[2]!)).toEqual(steps[2]);
  });

  it('skips other events and step-finishes of a superseded execution when rebuilding', () => {
    const [current] = publish([steps[1]!], 'execution-2');
    const [stale] = publish([steps[0]!], 'execution-1');
    const stepFinish = (diff: ResponseMessagesDiff, generation?: number) => ({
      type: 'chunk',
      ...(generation === undefined ? {} : { generation }),
      data: { type: 'step-finish', payload: { _durableResponseMessagesDiff: diff } },
    });
    const replay = replayResponseMessages([
      stepFinish(current!, 2),
      { type: 'chunk', data: { type: 'text-delta', payload: { _durableResponseMessagesDiff: stale } } },
      { type: 'finish', data: { type: 'step-finish', payload: { _durableResponseMessagesDiff: stale } } },
      // Still publishing after the newer claim took the run over.
      stepFinish(stale!, 1),
    ]);
    expect(replay.messages).toEqual(steps[1]);
    // Unfenced runs carry no generation; their events always apply.
    expect(replayResponseMessages([stepFinish(current!), stepFinish(stale!)]).messages).toEqual(steps[0]);
  });
});
