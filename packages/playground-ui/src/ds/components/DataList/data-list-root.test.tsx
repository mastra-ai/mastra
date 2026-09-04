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
  describe('unified treatment — ScrollArea (overlay scrollbar + horizontal mask)', () => {
    it('frames the list and separates its uniform rows', () => {
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
      expect(container.firstElementChild?.className).toContain('rounded-xl');
      expect(container.firstElementChild?.className).toContain('bg-surface4');
      expect(container.firstElementChild?.className).toContain('self-start');
      expect(container.firstElementChild?.className).toContain('max-h-full');
      expect(grid?.className).toContain('gap-y-px');
      expect(grid?.className).toContain('[&_.data-list-subheader+.data-list-row]:rounded-t-lg');
      expect(grid?.className).toContain('[&_.data-list-row:has(+.data-list-subheader)]:rounded-b-lg');
      expect(grid?.className).not.toMatch(/border-|ring-/);
      expect(grid?.className).not.toContain('[&_.data-list-row]:even:bg-surface-overlay-soft');
    });

    it('drops the panel background in the light variant but keeps the header opaque', () => {
      const { container } = render(
        <DataList columns="1fr 1fr" variant="light">
          <Header />
        </DataList>,
      );

      const root = container.firstElementChild as HTMLElement;
      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(root.className).not.toContain('bg-surface4');
      expect(root.className).toContain('rounded-xl');
      expect(root.getAttribute('variant')).toBeNull();
      expect(grid?.style.getPropertyValue('--data-list-background')).toBe('var(--surface1)');
      expect(grid?.className).toContain('[&_.data-list-top]:bg-(--data-list-background)');
    });

    it('only defines the background color on the root; sticky parts reuse it', () => {
      const { container } = render(
        <DataList columns="1fr 1fr">
          <Header />
        </DataList>,
      );

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      expect(grid?.style.getPropertyValue('--data-list-background')).toBe('var(--surface4)');
      expect(grid?.className).toContain('[&_.data-list-top]:bg-(--data-list-background)');
      expect(grid?.className).toContain('[&_.data-list-row>.data-list-sticky-start]:bg-surface2');
      expect(grid?.className).not.toMatch(/hover:bg-|focus-within\]:bg-/);
      expect(grid?.className).not.toContain('surface-header');
      expect(grid?.className).not.toContain('surface-overlay');
      expect(grid?.style.getPropertyValue('--data-list-border')).toBe('');
      expect(grid?.className).not.toMatch(/border-|ring-|--data-list-border/);
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

    it('allows callers to disable the left mask while keeping the right overflow mask', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" mask={{ left: false }} scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current?.className).not.toContain('mask-l-from');
      expect(scrollRef.current?.className).toContain('mask-r-from');
      expect(scrollRef.current?.className).not.toContain('mask-t-from');
    });

    it('leaves the top unfaded by default, since the header sits there', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current?.className).not.toContain('mask-t-from');
      expect(scrollRef.current?.className).toContain('mask-b-from');
    });

    it('fades the top when the caller asks for it by name', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" mask={{ top: true }} scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current?.className).toContain('mask-t-from');
    });

    it('fades every end when the caller turns masking on outright', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" mask scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current?.className).toContain('mask-t-from');
      expect(scrollRef.current?.className).toContain('mask-b-from');
    });

    it('fades nothing when the caller turns masking off', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" mask={false} scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      expect(scrollRef.current?.className).not.toContain('mask-');
    });

    it('lets max-height classes constrain the scrollable viewport', () => {
      const scrollRef = createRef<HTMLDivElement>();
      render(
        <DataList columns="1fr 1fr" className="max-h-80" scrollRef={scrollRef}>
          <Header />
          {Array.from({ length: 20 }, (_, index) => (
            <DataList.RowStatic key={index}>
              <DataList.Cell>row {index + 1}</DataList.Cell>
              <DataList.Cell>value {index + 1}</DataList.Cell>
            </DataList.RowStatic>
          ))}
        </DataList>,
      );

      // The root is a flex column clamped by max-height (flex, unlike grid `1fr`,
      // shrinks items against the clamped size); the viewport is the shrinkable item
      // so short lists stay compact and long ones scroll.
      const root = scrollRef.current?.parentElement;
      expect(root?.className).toContain('flex-col');
      // Consumer max-height overrides the default `max-h-full`.
      expect(root?.className).toContain('max-h-80');
      expect(root?.className).not.toContain('max-h-full');
      expect(root?.className).not.toContain('size-full');
      expect(scrollRef.current?.className).toContain('min-h-0');
      expect(scrollRef.current?.className).toContain('flex-1');
    });
  });

  describe('ScrollArea ownership', () => {
    it('wraps the grid in a ScrollArea, which owns scrolling', () => {
      const { container } = render(
        <DataList columns="1fr 1fr">
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
    });
  });

  describe('virtualized (scrollRef forwarded to the viewport)', () => {
    it('points scrollRef at the scrolling viewport that contains the grid', () => {
      const scrollRef = createRef<HTMLDivElement>();
      const { container } = render(
        <DataList columns="1fr 1fr" scrollRef={scrollRef}>
          <Header />
        </DataList>,
      );

      // scrollRef resolves to the ScrollArea viewport (the scroll element the
      // virtualizer binds to via getScrollElement), not the grid — so the list
      // virtualizes against the overlay-scrollbar viewport.
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
    it('exposes the error tone as data-variant without painting a color', () => {
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
      expect(errorRow.dataset.variant).toBe('error');
      expect(errorRow.className).toContain('bg-surface2');
      expect(errorRow.className).toContain('data-[variant=error]:bg-notice-destructive/10');
      expect(errorRow.className).toContain('hover:bg-surface3');
      expect(errorRow.className).toContain('active:bg-surface4');
      expect(errorRow.className).toContain('focus-visible:ring-accent1');
      expect(defaultRow.dataset.variant).toBe('default');
    });

    it('exposes featured rows as data-featured with the featured fill', () => {
      const { container } = render(
        <DataList columns="1fr">
          <DataList.RowButton featured>
            <DataList.Cell>selected</DataList.Cell>
          </DataList.RowButton>
        </DataList>,
      );
      const row = container.querySelector<HTMLButtonElement>('.data-list-row');
      expect(row?.dataset.featured).toBe('true');
      expect(row?.className).toContain('bg-surface2');
      expect(row?.className).toContain('data-featured:bg-surface3');
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
