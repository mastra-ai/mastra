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
});
