// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TracesLayout } from '../traces-layout';

afterEach(() => cleanup());

/** With the span detail open the card takes the whole page and the list collapses away. */
function expectWideThread(container: HTMLElement) {
  const outer = container.firstElementChild;

  expect((outer as HTMLElement).style.gridTemplateColumns).toBe('0fr 1fr');
  // A grid item's `auto` min-width would keep the collapsed track open.
  expect(outer?.className).toContain('[&>*:first-child]:min-w-0');
  expect((outer?.lastElementChild as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 2fr)');
  // Both grids animate, so the widening reads as one motion.
  expect(outer?.lastElementChild?.className).toContain('transition-[grid-template-columns]');
}

describe('TracesLayout', () => {
  describe('when only a list is given', () => {
    it('renders a single column', () => {
      const { container } = render(<TracesLayout listSlot={<p>list</p>} />);

      expect(screen.getByText('list')).toBeDefined();
      expect((container.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe('1fr');
    });
  });

  describe('when a trace panel is open', () => {
    it('splits the page between the list and the panel', () => {
      const { container } = render(<TracesLayout listSlot={<p>list</p>} tracePanelSlot={<p>trace</p>} />);

      expect(screen.getByText('trace')).toBeDefined();
      expect((container.firstElementChild as HTMLElement).style.gridTemplateColumns).toBe(
        'minmax(0, 1fr) minmax(0, 1fr)',
      );
    });
  });

  describe('when a thread accompanies the trace panel', () => {
    it('renders the thread beside the panel and yields the page to them', () => {
      const { container } = render(
        <TracesLayout listSlot={<p>list</p>} tracePanelSlot={<p>trace</p>} threadSlot={<p>thread</p>} />,
      );

      expect(screen.getByText('thread')).toBeDefined();
      expect(screen.getByText('trace')).toBeDefined();
      // Closed, the card takes 70% of the page and the list keeps the rest.
      const outer = container.firstElementChild;
      expect((outer as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 3fr) minmax(0, 7fr)');
      expect((outer?.lastElementChild as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 1fr)');
      // The thread reads top-down, so the card fills the page height.
      expect(outer?.className).toContain('h-full');
    });

    it('takes the whole page for the span panel, collapsing the list', () => {
      const { container } = render(
        <TracesLayout
          listSlot={<p>list</p>}
          tracePanelSlot={<p>trace</p>}
          threadSlot={<p>thread</p>}
          spanPanelSlot={<p>span</p>}
        />,
      );

      expectWideThread(container);
    });

    it('widens the same way when the span detail lives inside the trace panel', () => {
      // The traces page nests it there and only reports it through `sidePanelWide`.
      const { container } = render(
        <TracesLayout listSlot={<p>list</p>} tracePanelSlot={<p>trace</p>} threadSlot={<p>thread</p>} sidePanelWide />,
      );

      expectWideThread(container);
    });
  });

  describe('when a thread is given without a trace panel', () => {
    it('ignores the thread, since it only ever accompanies an open trace', () => {
      render(<TracesLayout listSlot={<p>list</p>} threadSlot={<p>thread</p>} />);

      expect(screen.queryByText('thread')).toBeNull();
    });
  });
});
