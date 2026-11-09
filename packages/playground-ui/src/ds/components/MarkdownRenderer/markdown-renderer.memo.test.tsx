// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MarkdownRenderer } from './markdown-renderer';

const parsed = vi.hoisted(() => [] as string[]);

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => {
    parsed.push(children);
    return <div>{children}</div>;
  },
}));

afterEach(() => {
  cleanup();
  parsed.length = 0;
  vi.useRealTimers();
});

/** A settled message next to something that re-renders on every streamed delta. */
function Transcript({ settled }: { settled: string }) {
  const [tick, setTick] = useState(0);

  return (
    <>
      <button onClick={() => setTick(tick + 1)}>tick {tick}</button>
      <MarkdownRenderer>{settled}</MarkdownRenderer>
    </>
  );
}

describe('MarkdownRenderer memoization', () => {
  it('does not re-parse a message whose text has not changed', () => {
    const { getByRole } = render(<Transcript settled="already **done**" />);

    fireEvent.click(getByRole('button'));
    fireEvent.click(getByRole('button'));

    expect(parsed).toEqual(['already **done**']);
  });

  it('re-parses no block the reveal has landed', () => {
    vi.useFakeTimers();
    const reply = 'Intro para.\n\nA middle paragraph.\n\nLast';
    const { rerender } = render(<MarkdownRenderer streaming>{reply}</MarkdownRenderer>);
    const reveal = () => {
      for (let frame = 0; frame < 150; frame++) act(() => void vi.advanceTimersByTime(16));
    };

    reveal();
    parsed.length = 0;

    rerender(<MarkdownRenderer streaming>{`${reply} para.`}</MarkdownRenderer>);
    reveal();

    expect(parsed.at(-1)).toBe('Last para.');
    expect(parsed.some(block => block.startsWith('Intro'))).toBe(false);
  });

  it.each([
    ['a tight list', Array.from({ length: 30 }, (_, index) => `- item ${index}`), '\n'],
    [
      'a spaced numbered list with nested points',
      Array.from(
        { length: 30 },
        (_, index) => `${index + 1}. **Step ${index}**\n${' '.repeat(`${index + 1}. `.length)}- detail`,
      ),
      '\n\n',
    ],
  ])('re-parses only the item still being written in %s', (_, items, separator) => {
    vi.useFakeTimers();
    const list = items.join(separator);
    const { rerender } = render(<MarkdownRenderer streaming>{list}</MarkdownRenderer>);
    const reveal = () => {
      for (let frame = 0; frame < 150; frame++) act(() => void vi.advanceTimersByTime(16));
    };

    reveal();
    parsed.length = 0;

    rerender(<MarkdownRenderer streaming>{`${list} more`}</MarkdownRenderer>);
    reveal();

    expect(new Set(parsed)).toEqual(new Set([`${items.at(-1)} more`]));
  });

  it.each([
    ['a bullet', '- a\n- b', '\n- ', 'c'],
    ['a number', '1. a\n2. b', '\n3.', ' c'],
  ])('re-parses no earlier item when %s lands before its text', (_, list, marker, text) => {
    vi.useFakeTimers();
    const { rerender } = render(<MarkdownRenderer streaming>{list}</MarkdownRenderer>);
    const reveal = () => {
      for (let frame = 0; frame < 150; frame++) act(() => void vi.advanceTimersByTime(16));
    };

    reveal();
    parsed.length = 0;

    rerender(<MarkdownRenderer streaming>{`${list}${marker}`}</MarkdownRenderer>);
    rerender(<MarkdownRenderer streaming>{`${list}${marker}${text}`}</MarkdownRenderer>);
    reveal();

    expect(parsed.filter(block => block.includes(' a'))).toEqual([]);
    expect(parsed.at(-1)).toBe(`${marker.slice(1)}${text}`);
  });
});
