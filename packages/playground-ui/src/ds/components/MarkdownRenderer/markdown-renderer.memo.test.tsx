// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
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

  it('re-parses only the block a streamed reply is still growing', () => {
    const { rerender } = render(<MarkdownRenderer streaming>{'First para.\n\nSecond'}</MarkdownRenderer>);

    parsed.length = 0;
    rerender(<MarkdownRenderer streaming>{'First para.\n\nSecond para.'}</MarkdownRenderer>);

    expect(parsed).toEqual(['Second para.']);
  });
});
