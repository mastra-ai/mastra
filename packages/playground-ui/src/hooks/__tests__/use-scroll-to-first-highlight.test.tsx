// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScrollToFirstHighlight } from '../use-scroll-to-first-highlight';

// jsdom has no layout, so it ships no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

function Harness({ search, resetKey, children }: { search: string; resetKey?: string; children?: React.ReactNode }) {
  const { ref } = useScrollToFirstHighlight<HTMLDivElement>(search, resetKey);
  return (
    <div ref={ref} data-highlight>
      {children}
    </div>
  );
}

describe('useScrollToFirstHighlight', () => {
  it('scrolls the parent element of the first match under [data-highlight]', () => {
    render(
      <Harness search="needle">
        <p>nothing here</p>
        <p data-testid="hit">a needle in a haystack</p>
        <p>another needle later</p>
      </Harness>,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const target = scrollIntoView.mock.instances[0] as HTMLElement;
    expect(target.textContent).toBe('a needle in a haystack');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('matches case-insensitively and literally', () => {
    render(
      <Harness search="Nee.le">
        <p>a needle would match a pattern, not a literal</p>
        <p data-testid="hit">but nee.le is UPPER: NEE.LE</p>
      </Harness>,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect((scrollIntoView.mock.instances[0] as HTMLElement).textContent).toContain('nee.le');
  });

  it('does nothing for queries shorter than 2 characters', () => {
    render(
      <Harness search="n">
        <p>a needle in a haystack</p>
      </Harness>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing when nothing matches and nothing ever arrives', () => {
    render(
      <Harness search="unicorn">
        <p>a needle in a haystack</p>
      </Harness>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('ignores text outside a data-highlight subtree', () => {
    function OutsideHarness() {
      const { ref } = useScrollToFirstHighlight<HTMLDivElement>('needle');
      return (
        <div ref={ref}>
          <p>a needle outside any opted-in region</p>
        </div>
      );
    }

    render(<OutsideHarness />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls only once per key, then re-scrolls when search changes', () => {
    const { rerender } = render(
      <Harness search="needle">
        <p>a needle in a haystack</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Same key: content re-render must not scroll again.
    rerender(
      <Harness search="needle">
        <p>a needle in a haystack</p>
        <p>more content</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <Harness search="haystack">
        <p>a needle in a haystack</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('re-scrolls when resetKey changes with the same search', () => {
    const { rerender } = render(
      <Harness search="needle" resetKey="span-1">
        <p>a needle in a haystack</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <Harness search="needle" resetKey="span-2">
        <p>a needle in a haystack</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('re-scrolls when the scrolled-to content is replaced by new content with the same match', async () => {
    // Selecting another span re-runs the effect while the panel still shows the previous
    // span's DOM: the first scan hits the stale match, then the real content swaps in.
    const { rerender } = render(
      <Harness search="needle" resetKey="span-2">
        <p>span-1 has a needle too</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <Harness search="needle" resetKey="span-2">
        <p data-testid="fresh">span-2 needle payload</p>
      </Harness>,
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect((scrollIntoView.mock.instances[1] as HTMLElement).textContent).toBe('span-2 needle payload');
  });

  it('does not re-scroll on mutations that leave the scrolled-to content in place', async () => {
    const { rerender } = render(
      <Harness search="needle" resetKey="span-1">
        <p>a needle in a haystack</p>
      </Harness>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <Harness search="needle" resetKey="span-1">
        <p>a needle in a haystack</p>
        <p>late sibling, also a needle</p>
      </Harness>,
    );

    // Give the observer's rAF a chance to run before asserting nothing happened.
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('scrolls to late-arriving content via the mutation observer', async () => {
    const { rerender } = render(<Harness search="needle">{null}</Harness>);
    expect(scrollIntoView).not.toHaveBeenCalled();

    // The async payload lands after mount, like the span detail finishing its fetch.
    rerender(
      <Harness search="needle">
        <p>a needle in a haystack</p>
      </Harness>,
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect((scrollIntoView.mock.instances[0] as HTMLElement).textContent).toBe('a needle in a haystack');
  });
});
