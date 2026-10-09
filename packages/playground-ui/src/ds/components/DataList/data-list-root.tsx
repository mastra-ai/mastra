import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useEffect, useId, useMemo } from 'react';
import {
  columnOrderSchema,
  getColumnOrderStorageKey,
  identityOrder,
  keyedColumnOrderSchema,
  moveIndex,
  moveKeyedOrder,
  normalizeOrder,
  resolveKeyedOrder,
  splitGridTracks,
} from './data-list-column-order';
import { DataListReorderContext } from './data-list-reorder-context';
import type { DataListReorderContextValue } from './data-list-reorder-context';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea/scroll-area';
import type { ScrollAreaMask, ScrollAreaProps } from '@/ds/components/ScrollArea/scroll-area';
import { FluidMenuItems, useFluidMenu } from '@/ds/primitives/fluid-menu';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { cn } from '@/lib/utils';

/**
 * Horizontal sizing of the list grid.
 *
 * - `content`: the grid is as wide as its widest content (`w-max`) and the
 *   ScrollArea scrolls horizontally when it exceeds the container.
 * - `container`: the grid fills the container width and never exceeds it;
 *   flexible tracks (`minmax(0, 1fr)`) shrink so truncating cells ellipsize
 *   instead of widening the table.
 */
export type DataListFit = 'content' | 'container';

/**
 * Surface treatment of the list.
 *
 * - `default`: rows sit as wells inside a raised card panel — the same material
 *   and elevation as a card, a popover or a settings container.
 * - `light`: no panel behind the rows; rows sit directly on the page.
 */
export type DataListVariant = 'default' | 'light';

export type DataListRootProps = Omit<ScrollAreaProps, 'children' | 'orientation' | 'mask'> & {
  children: ReactNode;
  columns: string;
  /** Grid width behavior; defaults to `content` (existing horizontal-scroll sizing). */
  fit?: DataListFit;
  /** Surface treatment; defaults to `default` (rows on a raised card panel). */
  variant?: DataListVariant;
  /**
   * Edge fades from the underlying ScrollArea. DataList keeps the top fade off
   * by default so it does not fade the sticky top header.
   */
  mask?: ScrollAreaMask;
  /**
   * Ref to the scroll container — pass this to TanStack Virtual's
   * `getScrollElement` when virtualizing. Without it, the ScrollArea viewport
   * scrolls normally.
   */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /**
   * Lets users drag header cells (or press Alt+Arrow on a focused header cell)
   * to reorder columns. Requires `id`: the order is persisted in localStorage
   * under that id. Sticky cells stay pinned. Supported for flat lists whose
   * header and rows span the full grid; `repeat()` templates are not supported.
   */
  reorderable?: boolean;
  /** Stable identifier of the list, used to persist the column order when `reorderable`. */
  id?: string;
  /**
   * Stable key per column, in `columns` order. With `reorderable`, the order is
   * persisted by key, so it survives columns being shown, hidden or added.
   * Without it, the order is persisted by index and resets when the column count changes.
   */
  columnKeys?: string[];
};

type DataListRootStyle = CSSProperties & {
  '--data-list-background'?: string;
};

function getDataListMask(mask: ScrollAreaMask | undefined): ScrollAreaMask {
  if (mask === undefined) return { top: false };
  if (mask === true || mask === false) return mask;

  return { top: false, ...mask };
}

/**
 * The root owns the unified table treatment so standalone and wrapped rows look
 * identical without requiring a per-row index. The ScrollArea provides the
 * fixed frame; this grid paints the sticky header and separators. The root is
 * the only element that defines a color: sticky parts read the background
 * through `--data-list-background` so they stay opaque while scrolling, and
 * rows/header draw no separators, borders or rings of their own.
 */
const dataListGridStyles = [
  'gap-y-px',
  // Rows are siblings of the header, so first/last are found via sibling combinators.
  '[&_.data-list-row:not(.data-list-row~.data-list-row)]:rounded-t-lg',
  '[&_.data-list-row:not(:has(~.data-list-row))]:rounded-b-lg',
  '[&_.data-list-row:not(.data-list-row~.data-list-row)>.data-list-sticky-start]:rounded-tl-lg',
  '[&_.data-list-row:not(:has(~.data-list-row))>.data-list-sticky-start]:rounded-bl-lg',
  // Subheaders split the rows into sections; each section gets its own rounded ends.
  '[&_.data-list-subheader+.data-list-row]:rounded-t-lg',
  '[&_.data-list-row:has(+.data-list-subheader)]:rounded-b-lg',
  '[&_.data-list-subheader+.data-list-row>.data-list-sticky-start]:rounded-tl-lg',
  '[&_.data-list-row:has(+.data-list-subheader)>.data-list-sticky-start]:rounded-bl-lg',
  // The fluid highlight follows the same ends: rounded only when the active
  // row is the first/last of its section, square everywhere else. `:has()`
  // cannot nest, so "last" is written as "no row follows the active one".
  '[&:has(.data-list-row[data-fluid-hover-active]:not(.data-list-row~.data-list-row))_[data-slot=fluid-hover-highlight]]:rounded-t-lg',
  '[&:has(.data-list-row[data-fluid-hover-active]):not(:has(.data-list-row[data-fluid-hover-active]~.data-list-row))_[data-slot=fluid-hover-highlight]]:rounded-b-lg',
  '[&:has(.data-list-subheader+.data-list-row[data-fluid-hover-active])_[data-slot=fluid-hover-highlight]]:rounded-t-lg',
  '[&:has(.data-list-row[data-fluid-hover-active]+.data-list-subheader)_[data-slot=fluid-hover-highlight]]:rounded-b-lg',
  '[&_.data-list-top]:bg-(--data-list-background)',
  '[&_.data-list-row>.data-list-sticky-start]:bg-background',
  // A sticky cell must stay opaque over horizontally scrolled cells, so it
  // cannot show the fluid highlight through; it takes the opaque twin of a fill
  // rung over the row well instead, the same level a selected row rests on.
  '[&_.data-list-row[data-fluid-hover-active]>.data-list-sticky-start]:bg-surface-panel',
  '[&_.data-list-row>.data-list-sticky-start]:after:right-0',
  '[&_.data-list-top>.data-list-sticky-start]:after:right-0',
] as const;

const dataListVariantClasses: Record<DataListVariant, string> = {
  default: raisedSurfaceStyle,
  light: '',
};

// The sticky header reads this so it stays opaque while scrolling: the panel
// material by default, the page surface when there is no panel.
const dataListVariantBackground: Record<DataListVariant, string> = {
  default: 'var(--card)',
  light: 'var(--background)',
};

const dataListFitClasses: Record<DataListFit, string> = {
  content: 'w-max max-w-none min-w-full',
  container: 'w-full max-w-full',
};

const disabledReorder: DataListReorderContextValue = { reorderable: false, order: [], move: () => {} };

export function DataListRoot({ reorderable, id, columns, columnKeys, ...props }: DataListRootProps) {
  const missingId = reorderable && !id;
  useEffect(() => {
    if (missingId) {
      console.warn('[DataList] `reorderable` requires an `id` to persist column order; reordering is disabled.');
    }
  }, [missingId]);

  const tracks = reorderable && id ? splitGridTracks(columns) : null;
  if (id && tracks && columnKeys && columnKeys.length === tracks.length) {
    return (
      <DataListKeyedReorderableRoot
        key={id}
        storageId={id}
        tracks={tracks}
        columnKeys={columnKeys}
        id={id}
        columns={columns}
        {...props}
      />
    );
  }
  if (id && tracks) {
    return <DataListReorderableRoot key={id} storageId={id} tracks={tracks} id={id} columns={columns} {...props} />;
  }
  return <DataListBase id={id} columns={columns} reorder={disabledReorder} {...props} />;
}

function DataListKeyedReorderableRoot({
  storageId,
  tracks,
  columnKeys,
  ...props
}: DataListReorderableRootProps & { columnKeys: string[] }) {
  const [stored, setStored] = useLocalStorageState({
    initialKey: getColumnOrderStorageKey(storageId),
    defaultValue: columnKeys,
    schema: keyedColumnOrderSchema,
  });
  const keysSignature = columnKeys.join('\u0000');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not array identity
  const order = useMemo(() => resolveKeyedOrder(stored, columnKeys), [stored, keysSignature]);

  const reorder = useMemo<DataListReorderContextValue>(
    () => ({
      reorderable: true,
      order,
      move: (from, to) => setStored(current => moveKeyedOrder(current, columnKeys, from, to)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content, not array identity
    [order, keysSignature, setStored],
  );

  return <DataListBase {...props} columns={order.map(i => tracks[i]).join(' ')} reorder={reorder} />;
}

type DataListReorderableRootProps = Omit<DataListRootProps, 'reorderable' | 'columnKeys'> & {
  storageId: string;
  tracks: string[];
};

function DataListReorderableRoot({ storageId, tracks, ...props }: DataListReorderableRootProps) {
  const count = tracks.length;
  const [stored, setStored] = useLocalStorageState({
    initialKey: getColumnOrderStorageKey(storageId),
    defaultValue: identityOrder(count),
    schema: columnOrderSchema,
  });
  const order = normalizeOrder(stored, count);

  const reorder = useMemo<DataListReorderContextValue>(
    () => ({
      reorderable: true,
      order,
      move: (from, to) => setStored(current => moveIndex(normalizeOrder(current, count), from, to)),
    }),
    [order, count, setStored],
  );

  return <DataListBase {...props} columns={order.map(i => tracks[i]).join(' ')} reorder={reorder} />;
}

type DataListBaseProps = Omit<DataListRootProps, 'reorderable' | 'columnKeys'> & {
  reorder: DataListReorderContextValue;
};

function DataListBase({
  children,
  columns,
  className,
  fit = 'content',
  variant = 'default',
  mask,
  scrollRef,
  reorder,
  ...props
}: DataListBaseProps) {
  const scopeId = useId();
  const gridStyle: DataListRootStyle = {
    '--data-list-background': dataListVariantBackground[variant],
    gridTemplateColumns: columns,
  };
  // Cells keep their DOM order; CSS `order` places each one in its moved track.
  const orderRules = reorder.reorderable
    ? reorder.order
        .map(
          (original, visual) =>
            `[data-data-list="${scopeId}"] .data-list-cells > :nth-child(${original + 1}) { order: ${visual}; }`,
        )
        .join('\n')
    : null;

  // One hover surface travels between rows (same primitive as menus/selects).
  // Subheaders, pagination and whitespace stay inert, so no gap-click routing.
  const menu = useFluidMenu<HTMLDivElement>({ gapClick: false });

  const grid = (
    <div
      // Lists scroll inside the ScrollArea viewport (below); the grid just lays out.
      // It is also the offsetParent rows are measured against and the highlight is positioned in.
      className={cn('grid content-start', ...dataListGridStyles, dataListFitClasses[fit], menu.containerClassName)}
      style={gridStyle}
      data-data-list={reorder.reorderable ? scopeId : undefined}
      {...menu.getContainerProps({})}
    >
      {orderRules && <style>{orderRules}</style>}
      {/* The highlight is the old row hover color. It sits between each row's
          `before` surface (-z-2) and the row content (see `dataListRowOuterStyles`). */}
      <FluidMenuItems menu={menu} className="rounded-none bg-fill-subtle">
        {children}
      </FluidMenuItems>
    </div>
  );

  // DataList uses the DS ScrollArea: an overlay scrollbar, so the sticky header
  // spans the full width. Masks default to every overflowing edge except the
  // top — a top fade would fade the opaque sticky header.
  return (
    <ScrollArea
      {...props}
      orientation="both"
      mask={getDataListMask(mask)}
      // Outer radius = row radius (8px) + 4px inset so the corners stay concentric.
      // Size to content but never exceed the parent. Flex (unlike grid `1fr`) lays
      // items out against the max-height-clamped container, so short lists stay
      // compact and long ones shrink the viewport and scroll. `self-start` stops
      // a grid/flex parent from stretching the root to the full row height.
      className={cn(
        'flex max-h-full w-full flex-col self-start rounded-xl p-1',
        dataListVariantClasses[variant],
        className,
      )}
    >
      <ScrollAreaViewport ref={scrollRef} className="min-h-0 flex-1 basis-auto">
        <DataListReorderContext.Provider value={reorder}>{grid}</DataListReorderContext.Provider>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
