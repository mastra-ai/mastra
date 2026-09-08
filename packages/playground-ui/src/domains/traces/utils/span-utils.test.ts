import type { SpanRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import {
  formatSpanDuration,
  formatSpanDurationExact,
  formatSpanPanelTimestamp,
  formatSpanTimestamp,
  formatSpanTimestampExact,
  getInputPreview,
  getTokenLimitMessage,
  isTokenLimitExceeded,
} from './span-utils';

const START = new Date('2026-01-01T00:00:00.000Z');
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

const TIMESTAMP = new Date('2026-01-05T14:03:07.250Z');
const MIDNIGHT = new Date('2026-01-05T00:00:00.000Z');

describe('formatSpanDuration', () => {
  describe('when a span has valid start and end times', () => {
    it('formats milliseconds and rounds seconds to one decimal place', () => {
      expect(formatSpanDuration(START, at(425))).toBe('425ms');
      expect(formatSpanDuration(START, at(1250))).toBe('1.3s');
      expect(formatSpanDuration(START, at(46301))).toBe('46.3s');
    });

    it('switches to seconds at exactly one second', () => {
      expect(formatSpanDuration(START, at(999))).toBe('999ms');
      expect(formatSpanDuration(START, at(1000))).toBe('1.0s');
    });

    it('reports a zero-length span as 0ms', () => {
      expect(formatSpanDuration(START, START)).toBe('0ms');
    });

    it('accepts ISO strings as well as Date objects', () => {
      expect(formatSpanDuration('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.425Z')).toBe('425ms');
    });
  });

  describe('when a span is running or has invalid timing', () => {
    it('leaves the duration empty', () => {
      expect(formatSpanDuration(START, undefined)).toBeUndefined();
      expect(formatSpanDuration(START, null)).toBeUndefined();
      expect(formatSpanDuration(undefined, START)).toBeUndefined();
      expect(formatSpanDuration(null, START)).toBeUndefined();
      expect(formatSpanDuration('not-a-date', START)).toBeUndefined();
      expect(formatSpanDuration(START, 'not-a-date')).toBeUndefined();
      expect(formatSpanDuration(new Date('not-a-date'), START)).toBeUndefined();
      // End before start means the trace is inconsistent, not instantaneous.
      expect(formatSpanDuration(at(1000), START)).toBeUndefined();
    });
  });
});

describe('formatSpanDurationExact', () => {
  it('keeps every millisecond once the span passes one second', () => {
    expect(formatSpanDurationExact(START, at(425))).toBe('425ms');
    expect(formatSpanDurationExact(START, at(999))).toBe('999ms');
    expect(formatSpanDurationExact(START, at(1000))).toBe('1s');
    expect(formatSpanDurationExact(START, at(1250))).toBe('1.25s');
    expect(formatSpanDurationExact(START, at(46301))).toBe('46.301s');
  });

  it('leaves the duration empty when the timing is unusable', () => {
    expect(formatSpanDurationExact(START, undefined)).toBeUndefined();
    expect(formatSpanDurationExact(at(1000), START)).toBeUndefined();
  });
});

describe('formatSpanTimestamp', () => {
  it('formats the 12-hour wall-clock time', () => {
    expect(formatSpanTimestamp(TIMESTAMP)).toBe('2:03:07 PM');
    expect(formatSpanTimestamp(MIDNIGHT)).toBe('12:00:00 AM');
  });

  it('leaves the timestamp empty instead of throwing', () => {
    expect(formatSpanTimestamp(undefined)).toBeUndefined();
    expect(formatSpanTimestamp(null)).toBeUndefined();
    expect(formatSpanTimestamp('not-a-date')).toBeUndefined();
  });
});

describe('formatSpanTimestampExact', () => {
  it('formats the full date down to milliseconds', () => {
    expect(formatSpanTimestampExact(TIMESTAMP)).toBe('Jan 5, 2026, 2:03:07.250 PM');
  });

  it('leaves the timestamp empty instead of throwing', () => {
    expect(formatSpanTimestampExact(undefined)).toBeUndefined();
    expect(formatSpanTimestampExact('not-a-date')).toBeUndefined();
  });
});

describe('formatSpanPanelTimestamp', () => {
  describe('when a span has a valid timestamp', () => {
    it('formats the zero-padded day and 12-hour time with milliseconds', () => {
      expect(formatSpanPanelTimestamp(TIMESTAMP)).toBe('Jan 05, 2:03:07.250 pm');
      expect(formatSpanPanelTimestamp(MIDNIGHT)).toBe('Jan 05, 12:00:00.000 am');
    });

    it('accepts an ISO string', () => {
      expect(formatSpanPanelTimestamp('2026-01-05T14:03:07.250Z')).toBe('Jan 05, 2:03:07.250 pm');
    });
  });

  describe('when a span timestamp is missing or unparseable', () => {
    it('leaves the timestamp empty instead of throwing', () => {
      expect(formatSpanPanelTimestamp(undefined)).toBeUndefined();
      expect(formatSpanPanelTimestamp(null)).toBeUndefined();
      expect(formatSpanPanelTimestamp('not-a-date')).toBeUndefined();
      expect(formatSpanPanelTimestamp(new Date('not-a-date'))).toBeUndefined();
    });
  });
});

describe('getInputPreview', () => {
  it('returns an empty preview for a missing input', () => {
    expect(getInputPreview(null)).toBe('');
    expect(getInputPreview(undefined)).toBe('');
  });

  it('joins the text of every user message and skips the other roles', () => {
    const input = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'An answer' },
      { role: 'user', content: 'Second question' },
    ];

    expect(getInputPreview(input)).toBe('First question | Second question');
  });

  it('unwraps the legacy { messages } envelope of agent_run spans', () => {
    expect(getInputPreview({ messages: [{ role: 'user', content: 'Hello' }] })).toBe('Hello');
  });

  it('reads the text parts of a multi-part user message', () => {
    const input = [
      {
        role: 'user',
        content: [
          'a bare string part',
          { type: 'text', text: 'a text part' },
          // A non-text part is skipped even when it carries its own `text`.
          { type: 'image', image: 'https://example.com/a.png', text: 'alt caption' },
          // A text part is skipped when its `text` is not a string.
          { type: 'text', text: 42 },
          null,
          { type: 'text', text: '' },
        ],
      },
    ];

    expect(getInputPreview(input)).toBe('a bare string part a text part');
  });

  it('drops user messages whose content is neither string nor array', () => {
    const input = [
      { role: 'user', content: { unexpected: true } },
      { role: 'user', content: 'kept' },
    ];

    expect(getInputPreview(input)).toBe('kept');
  });

  it('tolerates holes in the message array', () => {
    expect(getInputPreview([null, { role: 'user', content: 'kept' }])).toBe('kept');
  });

  it('truncates a long joined preview with an ellipsis', () => {
    const input = [{ role: 'user', content: 'x'.repeat(150) }];

    expect(getInputPreview(input)).toBe(`${'x'.repeat(100)}…`);
    expect(getInputPreview(input, 10)).toBe(`${'x'.repeat(10)}…`);
  });

  it('leaves a preview exactly at the limit untruncated', () => {
    expect(getInputPreview([{ role: 'user', content: 'x'.repeat(100) }])).toBe('x'.repeat(100));
  });

  it('returns a plain string input as-is, truncating past the limit', () => {
    expect(getInputPreview('a short prompt')).toBe('a short prompt');
    expect(getInputPreview('y'.repeat(101))).toBe(`${'y'.repeat(100)}…`);
    expect(getInputPreview('y'.repeat(100))).toBe('y'.repeat(100));
  });

  it('falls back to JSON for anything else, truncating past the limit', () => {
    expect(getInputPreview({ query: 'weather' })).toBe('{"query":"weather"}');
    expect(getInputPreview({ query: 'z'.repeat(200) })).toBe(
      `${JSON.stringify({ query: 'z'.repeat(200) }).slice(0, 100)}…`,
    );
    // `{"q":"..."}` is exactly 100 characters, so it is left whole.
    const exactly100 = JSON.stringify({ q: 'z'.repeat(92) });
    expect(exactly100).toHaveLength(100);
    expect(getInputPreview({ q: 'z'.repeat(92) })).toBe(exactly100);
  });
});

const spanWith = (attributes: Record<string, unknown>) => ({ attributes }) as unknown as SpanRecord;

describe('isTokenLimitExceeded', () => {
  it('is true only when the model stopped on length', () => {
    expect(isTokenLimitExceeded(spanWith({ finishReason: 'length' }))).toBe(true);
    expect(isTokenLimitExceeded(spanWith({ finishReason: 'stop' }))).toBe(false);
    expect(isTokenLimitExceeded(spanWith({}))).toBe(false);
    expect(isTokenLimitExceeded(undefined)).toBeFalsy();
    // A span may arrive with no attributes at all.
    expect(isTokenLimitExceeded({} as SpanRecord)).toBeFalsy();
  });
});

describe('getTokenLimitMessage', () => {
  const BASE =
    'The model stopped generating because it reached the maximum token limit. The response was truncated and may be incomplete.';

  it('explains the truncation without numbers when there is no usage', () => {
    expect(getTokenLimitMessage(spanWith({}))).toBe(BASE);
    expect(getTokenLimitMessage(undefined)).toBe(BASE);
  });

  it('breaks the usage down when either side is non-zero', () => {
    expect(getTokenLimitMessage(spanWith({ usage: { inputTokens: 900, outputTokens: 100, totalTokens: 1000 } }))).toBe(
      `${BASE}\n\nToken usage: 900 input + 100 output = 1000 total`,
    );
    expect(getTokenLimitMessage(spanWith({ usage: { outputTokens: 100 } }))).toBe(
      `${BASE}\n\nToken usage: 0 input + 100 output = 100 total`,
    );
    expect(getTokenLimitMessage(spanWith({ usage: { inputTokens: 900 } }))).toBe(
      `${BASE}\n\nToken usage: 900 input + 0 output = 900 total`,
    );
  });

  it('derives the total from the two sides when the server omits it', () => {
    expect(getTokenLimitMessage(spanWith({ usage: { inputTokens: 900, outputTokens: 100 } }))).toBe(
      `${BASE}\n\nToken usage: 900 input + 100 output = 1000 total`,
    );
  });

  it('reports only the total when no breakdown is available', () => {
    expect(getTokenLimitMessage(spanWith({ usage: { totalTokens: 4096 } }))).toBe(
      'The model stopped generating because it reached the maximum token limit (4096 tokens). The response was truncated and may be incomplete.',
    );
  });
});
