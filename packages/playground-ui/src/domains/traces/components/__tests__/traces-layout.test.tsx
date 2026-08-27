// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TracesLayout } from '../traces-layout';

afterEach(() => cleanup());

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

    it('widens the panel when the span detail is shown inside it', () => {
      const { container } = render(<TracesLayout listSlot={<p>list</p>} tracePanelSlot={<p>trace</p>} sidePanelWide />);

      const outer = container.firstElementChild as HTMLElement;
      expect(outer.style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 4fr)');
      // The widening reads as one motion.
      expect(outer.className).toContain('transition-[grid-template-columns]');
    });
  });
});
