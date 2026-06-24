// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DataList } from './data-list';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

const Header = () => (
  <DataList.Top>
    <DataList.TopCell>Name</DataList.TopCell>
    <DataList.TopCell>Description</DataList.TopCell>
  </DataList.Top>
);

describe('DataListRoot', () => {
  describe('lined default variant — ScrollArea (overlay scrollbar + horizontal mask)', () => {
    it('uses lined styling when no variant is provided', () => {
      const { container } = render(
        <DataList columns="1fr 1fr">
          <Header />
          <DataList.RowButton>
            <DataList.Cell>one</DataList.Cell>
            <DataList.Cell>first row</DataList.Cell>
          </DataList.RowButton>
          <DataList.RowButton>
            <DataList.Cell>two</DataList.Cell>
            <DataList.Cell>second row</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      expect(grid).not.toBe(container.firstElementChild);
      expect(grid?.className).not.toContain('overflow-auto');
      expect(grid?.className).toContain('gap-y-px');
      expect(grid?.className).toContain('[&_.data-list-row]:after:absolute');
      expect(grid?.className).toContain('[&_.data-list-row]:after:content-[""]');
      expect(grid?.className).toContain('[&_.data-list-row]:after:inset-x-2');
      expect(grid?.className).toContain('[&_.data-list-row]:after:-bottom-px');
      expect(grid?.className).toContain('[&_.data-list-row]:after:bg-neutral6/10');
      expect(grid?.className).not.toContain('[&_.data-list-row]:even:bg-surface-overlay-soft');
      expect(grid?.className).not.toContain('[&_.data-list-row]:after:hidden');
    });

    it('forwards scrollRef to the scrolling viewport that contains the grid', () => {
      const scrollRef = createRef<HTMLDivElement>();
      const { container } = render(
        <DataList columns="1fr 1fr" scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current).not.toBeNull();
      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      expect(scrollRef.current).not.toBe(grid);
      expect(scrollRef.current?.contains(grid)).toBe(true);
    });
  });

  describe('striped variant — ScrollArea (overlay scrollbar + horizontal mask)', () => {
    it('wraps the grid in a ScrollArea, which owns scrolling', () => {
      const { container } = render(
        <DataList columns="1fr 1fr" variant="striped">
          <Header />
        </DataList>,
      );

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      // grid is nested inside the ScrollArea, not the root child
      expect(grid).not.toBe(container.firstElementChild);
      // the ScrollArea viewport owns scrolling, so the grid doesn't
      expect(grid?.className).not.toContain('overflow-auto');
      expect(grid?.className).toContain('gap-y-px');
      expect(grid?.className).toContain('[&_.data-list-row]:after:hidden');
      expect(grid?.className).toContain('[&_.data-list-row]:even:bg-surface-overlay-soft');
      expect(grid?.className).not.toContain('[&_.data-list-row]:after:bg-neutral6/10');
      expect(grid?.className).not.toContain('[&_.data-list-row]:after:-bottom-px');
    });
  });

  describe('lined variant — ScrollArea (overlay scrollbar + horizontal mask)', () => {
    it('wraps the grid in a ScrollArea, which owns scrolling', () => {
      const { container } = render(
        <DataList columns="1fr 1fr" variant="lined">
          <Header />
        </DataList>,
      );

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      expect(grid).not.toBe(container.firstElementChild);
      expect(grid?.className).not.toContain('overflow-auto');
    });

    it('uses subtle row separators instead of zebra row backgrounds', () => {
      const { container } = render(
        <DataList columns="1fr 1fr" variant="lined">
          <Header />
          <DataList.RowButton>
            <DataList.Cell>one</DataList.Cell>
            <DataList.Cell>first row</DataList.Cell>
          </DataList.RowButton>
          <DataList.RowButton>
            <DataList.Cell>two</DataList.Cell>
            <DataList.Cell>second row</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid?.className).toContain('gap-y-px');
      expect(grid?.className).toContain('[&_.data-list-row]:after:absolute');
      expect(grid?.className).toContain('[&_.data-list-row]:after:content-[""]');
      expect(grid?.className).toContain('[&_.data-list-row]:after:inset-x-2');
      expect(grid?.className).toContain('[&_.data-list-row]:after:-bottom-px');
      expect(grid?.className).toContain('[&_.data-list-row]:after:bg-neutral6/10');
      expect(grid?.className).not.toContain('[&_.data-list-row]:even:bg-surface-overlay-soft');
      expect(grid?.className).not.toContain('[&_.data-list-row]:after:hidden');
    });
  });

  describe('striped variant — virtualized (scrollRef forwarded to the viewport)', () => {
    it('points scrollRef at the scrolling viewport that contains the grid', () => {
      const scrollRef = createRef<HTMLDivElement>();
      const { container } = render(
        <DataList columns="1fr 1fr" variant="striped" scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      // scrollRef now resolves to the ScrollArea viewport (the scroll element the
      // virtualizer binds to via getScrollElement), not the grid — so the list
      // virtualizes against the overlay-scrollbar viewport.
      expect(scrollRef.current).not.toBeNull();
      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      expect(scrollRef.current).not.toBe(grid);
      expect(scrollRef.current?.contains(grid)).toBe(true);
    });
  });

  describe('lined variant — virtualized (scrollRef forwarded to the viewport)', () => {
    it('points scrollRef at the scrolling viewport that contains the grid', () => {
      const scrollRef = createRef<HTMLDivElement>();
      const { container } = render(
        <DataList columns="1fr 1fr" variant="lined" scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current).not.toBeNull();
      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid).not.toBeNull();
      expect(scrollRef.current).not.toBe(grid);
      expect(scrollRef.current?.contains(grid)).toBe(true);
    });
  });

  describe('header titles — overflow / sizing', () => {
    it('truncates plain-text titles via an inner truncate span', () => {
      const { container } = render(
        <DataList columns="1fr">
          <DataList.Top>
            <DataList.TopCell>A title long enough to need truncation</DataList.TopCell>
          </DataList.Top>
        </DataList>,
      );
      const cell = container.querySelector<HTMLElement>('.data-list-top > *');
      const inner = cell?.querySelector<HTMLElement>('span.truncate');
      expect(inner).not.toBeNull();
      expect(inner?.textContent).toBe('A title long enough to need truncation');
    });

    it('renders non-text title children as-is (not wrapped)', () => {
      const { container } = render(
        <DataList columns="1fr">
          <DataList.Top>
            <DataList.TopCell>
              <svg data-testid="icon" />
            </DataList.TopCell>
          </DataList.Top>
        </DataList>,
      );
      const cell = container.querySelector<HTMLElement>('.data-list-top > *');
      expect(cell?.querySelector('span.truncate')).toBeNull();
      expect(cell?.querySelector('[data-testid="icon"]')).not.toBeNull();
    });
  });

  describe('selection header layout', () => {
    it('keeps grouped header cells from covering the select-all checkbox', () => {
      const onToggle = vi.fn();
      const { container } = render(
        <DataList columns="auto 1fr 1fr">
          <DataList.Top hasLeadingCell>
            <DataList.TopSelectCell checked={false} onToggle={onToggle} aria-label="Select all" />
            <DataList.TopCells colStart={2} data-testid="header-cells">
              <DataList.TopCell>Name</DataList.TopCell>
              <DataList.TopCell>Description</DataList.TopCell>
            </DataList.TopCells>
          </DataList.Top>
        </DataList>,
      );

      const headerCells = container.querySelector<HTMLElement>('[data-testid="header-cells"]');
      expect(headerCells?.style.gridColumn).toBe('2 / -1');
      expect(headerCells?.className).toContain('pointer-events-none');
      expect(headerCells?.className).toContain('[&>*]:pointer-events-auto');
      expect(headerCells?.className).not.toContain('col-span-full');

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-row error variant', () => {
    it('applies a destructive tint to error rows and nothing to default rows', () => {
      const { container } = render(
        <DataList columns="1fr">
          <DataList.RowButton variant="error">
            <DataList.Cell>boom</DataList.Cell>
          </DataList.RowButton>
          <DataList.RowButton>
            <DataList.Cell>ok</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );
      const [errorRow, defaultRow] = container.querySelectorAll<HTMLButtonElement>('.data-list-row');
      expect(errorRow.className).toContain('bg-notice-destructive/10');
      expect(defaultRow.className).not.toContain('bg-notice-destructive');
    });

    it('applies the selection fill as `!important` so it wins over borderless table styling', () => {
      // Borderless table styling uses root descendant rules (higher specificity),
      // so a plain `bg-surface4` would lose. The `!` keeps the selected row
      // highlighted regardless of the root variant.
      const { container } = render(
        <DataList columns="1fr" variant="striped">
          <DataList.RowButton featured>
            <DataList.Cell>selected</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );
      const row = container.querySelector<HTMLButtonElement>('.data-list-row');
      expect(row?.className).toContain('bg-surface4!');
    });

    it('does not leak the variant prop onto the DOM element', () => {
      const { container } = render(
        <DataList columns="1fr">
          <DataList.RowButton variant="error">
            <DataList.Cell>boom</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );
      const row = container.querySelector<HTMLButtonElement>('.data-list-row');
      expect(row?.getAttribute('variant')).toBeNull();
    });
  });
});
