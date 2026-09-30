// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollapsibleBox } from './collapsible-box';
import { useCollapsibleBox } from './use-collapsible-box';

function Harness({ collapsedHeight }: { collapsedHeight?: number }) {
  const box = useCollapsibleBox({ collapsedHeight });
  return (
    <div>
      {(box.isClipped || box.isExpanded) && (
        <button type="button" onClick={box.toggleExpanded}>
          {box.isExpanded ? 'Collapse' : 'Expand'}
        </button>
      )}
      <CollapsibleBox state={box}>content</CollapsibleBox>
    </div>
  );
}

const box = () => document.querySelector<HTMLElement>('[data-slot="collapsible-box"]');
const mockScrollHeight = (height: number) =>
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(height);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CollapsibleBox', () => {
  describe('when the content fits', () => {
    it('does not mark it clipped and the consumer shows no control', () => {
      mockScrollHeight(100);
      render(<Harness />);
      expect(box()?.hasAttribute('data-clipped')).toBe(false);
      expect(box()?.style.maxHeight).toBe('220px');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when the content overflows', () => {
    it('clips and fades it, and the external control expands and collapses it', () => {
      mockScrollHeight(1000);
      render(<Harness />);
      expect(box()?.getAttribute('data-clipped')).toBe('');
      expect(box()?.style.maxHeight).toBe('220px');

      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
      expect(box()?.hasAttribute('data-clipped')).toBe(false);
      expect(box()?.style.maxHeight).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(box()?.style.maxHeight).toBe('220px');
    });
  });

  describe('when a custom collapsed height is given', () => {
    it('clips at that height', () => {
      mockScrollHeight(300);
      render(<Harness collapsedHeight={400} />);
      expect(box()?.style.maxHeight).toBe('400px');
      expect(box()?.hasAttribute('data-clipped')).toBe(false);
    });
  });
});
