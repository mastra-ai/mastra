import { describe, expect, it } from 'vitest';

import { classifyInterruptedText, normalise, retainedReasoningFrames, withoutInterruptedText } from './normalise';
import { ABORT_ANSWER, FLOOD_REASONING } from './scenarios';
import { READERS } from './types';

describe('reader-visible payloads', () => {
  it('distinguishes tool failures with the same keys but different messages', () => {
    const failure = (message: string) => normalise([{ type: 'tool-error', payload: { error: new Error(message) } }]);
    expect(failure('kaboom')).not.toEqual(failure('unrelated failure'));
    expect(failure('kaboom')[0]?.shape).toContain('message="kaboom"');
  });

  it('compares streamed tool arguments even when the final call is intact', () => {
    const call = (argsTextDelta: string) =>
      normalise([
        { type: 'tool-call-delta', payload: { argsTextDelta } },
        { type: 'tool-call', payload: { toolName: 'lookup', args: { query: 'harness' } } },
      ]);
    expect(call('{"query":"harness"}')).not.toEqual(call('{"query":"corrupted"}'));
  });

  it('compares tool names and arguments, not random call identifiers', () => {
    const call = (toolName: string, args: object, toolCallId = 'random-1') =>
      normalise([{ type: 'tool-call', payload: { toolName, args, toolCallId } }]);
    expect(call('lookup', { query: 'harness' })).toEqual(call('lookup', { query: 'harness' }, 'random-2'));
    expect(call('lookup', { query: 'harness' })).not.toEqual(call('lookup', { query: 'corrupted' }));
    expect(call('lookup', { query: 'harness' })).not.toEqual(call('nothing', { query: 'harness' }));
  });
});

describe('generate abort payload validation', () => {
  it('distinguishes legitimate missing, empty, partial and whole text', () => {
    expect([undefined, '', 'This', ABORT_ANSWER].map(text => classifyInterruptedText(text, ABORT_ANSWER))).toEqual([
      'missing',
      'empty',
      'cut',
      'whole',
    ]);
  });

  it.each(['ThisThis', 'This ans ans', 'Thiswer ', 'unrelated output'])(
    'rejects corrupt result or callback text before classifying it as cut: %j',
    text => expect(() => classifyInterruptedText(text, ABORT_ANSWER)).toThrow(/not a prefix/),
  );
});

describe('broker reasoning retention', () => {
  const raw = (text: string) => [{ type: 'reasoning-delta', payload: { text } }, { type: 'finish' }];

  it('accepts approximate head trimming without hiding terminal frames', () => {
    expect(retainedReasoningFrames(raw(FLOOD_REASONING.slice(800)), FLOOD_REASONING)).toEqual([
      { type: 'reasoning-delta', shape: 'retained-suffix' },
      { type: 'finish' },
    ]);
  });

  it('rejects missing-interior, repeated, truncated-tail, empty, and untrimmed reasoning', () => {
    const suffix = FLOOD_REASONING.slice(800);
    for (const text of [
      suffix.slice(0, 100) + suffix.slice(104),
      suffix.slice(0, 100) + suffix.slice(96),
      suffix.slice(0, -4),
      '',
      FLOOD_REASONING,
    ]) {
      expect(() => retainedReasoningFrames(raw(text), FLOOD_REASONING)).toThrow(/exact, nonempty reasoning suffix/);
    }
  });
});

// Only cut points between separate executions are timing-dependent.
describe('interrupted output validation', () => {
  it.each(['This', 'This ans'])('allows a shared valid prefix %j while retaining terminal frames', text => {
    const capture = {
      live: normalise([{ type: 'text-delta', payload: { text } }, { type: '(killed)' }]),
      topic: normalise([{ type: 'text-delta', payload: { text } }]),
    };
    expect(withoutInterruptedText(capture, ABORT_ANSWER)).toEqual({
      live: [{ type: 'text-delta' }, { type: '(killed)' }],
      topic: [{ type: 'text-delta' }],
    });
    expect(capture.live[0]?.shape).toBe(text);
  });

  it.each(READERS.filter(reader => reader !== 'live'))('rejects tail loss by only %s within one run', reader => {
    const live = normalise([{ type: 'text-delta', payload: { text: 'This answer' } }]);
    for (const text of ['This', '']) {
      const replay = normalise(text ? [{ type: 'text-delta', payload: { text } }] : []);
      expect(() => withoutInterruptedText({ live, [reader]: replay }, ABORT_ANSWER)).toThrow(
        `${reader}: interrupted output differs from live`,
      );
    }
  });

  it.each([{}, { text: '' }, undefined])('rejects a text delta with an empty or missing payload: %j', payload => {
    expect(() => withoutInterruptedText({ live: normalise([{ type: 'text-delta', payload }]) }, ABORT_ANSWER)).toThrow(
      /live: interrupted output is not a prefix/,
    );
  });

  it.each(READERS)('rejects corrupted raw deltas from %s before masking', reader => {
    for (const deltas of [['This', 'This'], ['This', ' ans', ' ans'], ['This', 'wer '], ['Not the scripted reply']]) {
      const frames = normalise(deltas.map(text => ({ type: 'text-delta', payload: { text } })));
      expect(() => withoutInterruptedText({ [reader]: frames }, ABORT_ANSWER)).toThrow(
        `${reader}: interrupted output is not a prefix`,
      );
    }
  });

  it('rejects unexpected reasoning rather than erasing it', () => {
    const frames = normalise([{ type: 'reasoning-delta', payload: { text: 'Unexpected reasoning' } }]);
    expect(() => withoutInterruptedText({ live: frames }, ABORT_ANSWER)).toThrow(/live: interrupted output/);
  });
});
