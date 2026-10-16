// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanSummaryDescription } from '../span-summary-description';

afterEach(cleanup);

const span = {
  startedAt: '2026-06-01T17:09:59.665Z',
  endedAt: '2026-06-01T17:10:02.000Z',
};

describe('SpanSummaryDescription', () => {
  it.each([
    ['an ISO string', '2026-06-01T17:10:00.899Z', '1.234 s'],
    ['a Date', new Date('2026-06-01T17:10:00.000Z'), '335 ms'],
    ['the span start', '2026-06-01T17:09:59.665Z', '0 ms'],
  ])('shows time to first chunk when the first chunk time is %s', (_, completionStartTime, expected) => {
    render(<SpanSummaryDescription span={{ ...span, attributes: { completionStartTime } }} />);

    expect(screen.getByLabelText(`Time to first chunk ${expected}`).textContent).toBe(expected);
  });

  it.each([
    ['no attributes', undefined],
    ['no first chunk time', { streaming: true }],
    ['an invalid first chunk time', { completionStartTime: 'not a date' }],
  ])('hides time to first chunk for %s', (_, attributes) => {
    render(<SpanSummaryDescription span={{ ...span, attributes }} />);

    expect(screen.getByLabelText('Duration 2.335 s')).not.toBeNull();
    expect(screen.queryByLabelText(/Time to first chunk/)).toBeNull();
  });
});
