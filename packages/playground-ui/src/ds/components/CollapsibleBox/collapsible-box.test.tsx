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
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('220px');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when the content overflows', () => {
    it('clips and fades it, and the external control expands and collapses it', () => {
      mockScrollHeight(1000);
      render(<Harness />);
      expect(box()?.getAttribute('data-clipped')).toBe('');
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('220px');

      // The fade must mask the clipped box itself, or it lands below the visible area.
      const masked = box()?.querySelector<HTMLElement>('.mask-b-from-60\\%.mask-b-to-100\\%');
      expect(masked?.style.maxHeight).toBe('220px');

      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
      expect(box()?.hasAttribute('data-clipped')).toBe(false);
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('220px');
    });
  });

  describe('the fade', () => {
    const fade = () => document.querySelector<HTMLElement>('[data-slot="collapsible-box-fade"]');

    function Bare({ expandLabel }: { expandLabel?: string }) {
      const state = useCollapsibleBox();
      return (
        <CollapsibleBox state={state} expandLabel={expandLabel}>
          content
        </CollapsibleBox>
      );
    }

    function CollapsibleBoxWithClass({ className, children }: { className: string; children: string }) {
      const state = useCollapsibleBox();
      return (
        <CollapsibleBox state={state} className={className}>
          {children}
        </CollapsibleBox>
      );
    }

    it('expands the box when clicked', () => {
      mockScrollHeight(1000);
      render(<Bare />);
      fireEvent.click(fade() as HTMLElement);
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('');
      expect(fade()).toBeNull();
    });

    it('shows an expand button when a label is given', () => {
      mockScrollHeight(1000);
      render(<Bare expandLabel="Expand" />);
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('');
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('covers the whole box, anchored to the box root even when a consumer passes `static`', () => {
      mockScrollHeight(1000);
      render(<CollapsibleBoxWithClass className="static">content</CollapsibleBoxWithClass>);
      expect(fade()?.classList.contains('inset-0')).toBe(true);
      expect(fade()?.parentElement).toBe(box());
      expect(box()?.classList.contains('relative')).toBe(true);
      expect(box()?.classList.contains('static')).toBe(false);
    });

    it('catches clicks over the content and expands, then lets them through once expanded', () => {
      mockScrollHeight(1000);
      const onContentClick = vi.fn();
      function Clickable() {
        const state = useCollapsibleBox();
        return (
          <CollapsibleBox state={state}>
            <button type="button" onClick={onContentClick}>
              Span row
            </button>
          </CollapsibleBox>
        );
      }
      render(<Clickable />);
      // jsdom has no hit testing: the overlay is what sits on top of the content.
      fireEvent.click(fade() as HTMLElement);
      expect(onContentClick).not.toHaveBeenCalled();
      expect(fade()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Span row' }));
      expect(onContentClick).toHaveBeenCalledTimes(1);
    });

    it('is not rendered when the content fits', () => {
      mockScrollHeight(100);
      render(<Bare expandLabel="Expand" />);
      expect(fade()).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when a custom collapsed height is given', () => {
    it('clips at that height', () => {
      mockScrollHeight(300);
      render(<Harness collapsedHeight={400} />);
      expect(box()?.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('400px');
      expect(box()?.hasAttribute('data-clipped')).toBe(false);
    });
  });
});
