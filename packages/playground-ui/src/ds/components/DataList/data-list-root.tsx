import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useId, useMemo } from 'react';
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
  /** Disable the internal scroll area when a parent owns scrolling, allowing row effects to extend outside the list. */
  scrollable?: boolean;
  /**
   * Edge fades where content is scrolled out of view, 1.25rem deep by default. The sticky
   * header never fades: the top edge fades the rows just below it instead.
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
  '--data-list-fade-top'?: string;
};

type MaskSide = NonNullable<Exclude<ScrollAreaMask, boolean>['top']>;

const DATA_LIST_FADE_DEPTH = '1.25rem';

const fadeSide = (side: MaskSide | undefined): MaskSide | undefined => (side === true ? DATA_LIST_FADE_DEPTH : side);

/** The top fade's depth, or `false` for none. Omitted means on, at the default depth. */
const topFadeDepth = (side: MaskSide = true): Exclude<MaskSide, true> => (side === true ? DATA_LIST_FADE_DEPTH : side);

/**
 * Splits the caller's `mask` into the ScrollArea's fades (bottom, left, right) and the top fade.
 * The ScrollArea's own top fade stays off, since it would fade the sticky header with the rows;
 * the top edge is a gradient under the header instead (see `dataListTopFadeStyles`).
 */
function resolveDataListMask(mask: ScrollAreaMask | undefined): {
  area: ScrollAreaMask;
  top: Exclude<MaskSide, true>;
} {
  if (mask === false) return { area: false, top: false };
  const sides = mask === true || mask === undefined ? {} : mask;
  return {
    area: {
      x: DATA_LIST_FADE_DEPTH,
      y: DATA_LIST_FADE_DEPTH,
      ...Object.fromEntries(Object.entries(sides).map(([key, side]) => [key, fadeSide(side)])),
      top: false,
    },
    top: topFadeDepth(sides.top ?? sides.y),
  };
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
  // The grid paints the root's colour so the 1px gaps between rows read as separators, also over the
  // well (below) that the fades reveal.
  'bg-(--data-list-background)',
  '[&_.data-list-top]:bg-(--data-list-background)',
  // Sticky cells stay opaque over horizontally scrolled cells, the header's included.
  '[&_.data-list-top>.data-list-sticky-start]:bg-(--data-list-background)',
  '[&_.data-list-row>.data-list-sticky-start]:bg-background',
  // A sticky cell cannot show the hover layer through; it takes the opaque twin
  // of a fill rung over the row well instead, the same level a selected row rests on.
  '[&_.data-list-row-interactive:not(:disabled):hover>.data-list-sticky-start]:bg-surface-panel',
  // The pinned column's edge: one 1px divider, drawn per cell (bridging the 1px row gaps), shown once
  // cells are scrolled under it.
  "[&_.data-list-sticky-start]:after:pointer-events-none [&_.data-list-sticky-start]:after:absolute [&_.data-list-sticky-start]:after:-top-px [&_.data-list-sticky-start]:after:right-0 [&_.data-list-sticky-start]:after:bottom-0 [&_.data-list-sticky-start]:after:w-px [&_.data-list-sticky-start]:after:bg-border [&_.data-list-sticky-start]:after:opacity-0 [&_.data-list-sticky-start]:after:transition-opacity [&_.data-list-sticky-start]:after:duration-fast [&_.data-list-sticky-start]:after:content-['']",
  'group-data-overflow-x-start/scroll-area:[&_.data-list-sticky-start]:after:opacity-100',
] as const;

/**
 * The top fade: a gradient hanging under the sticky header, into the row well, so rows fade as they
 * pass under the header while the header itself stays solid. Shown once rows are scrolled under it.
 */
const dataListTopFadeStyles = [
  "[&_.data-list-top]:after:pointer-events-none [&_.data-list-top]:after:absolute [&_.data-list-top]:after:inset-x-0 [&_.data-list-top]:after:top-full [&_.data-list-top]:after:h-(--data-list-fade-top) [&_.data-list-top]:after:bg-linear-to-b [&_.data-list-top]:after:from-background [&_.data-list-top]:after:to-transparent [&_.data-list-top]:after:opacity-0 [&_.data-list-top]:after:transition-opacity [&_.data-list-top]:after:duration-fast [&_.data-list-top]:after:content-['']",
  'group-data-overflow-y-start/scroll-area:[&_.data-list-top]:after:opacity-100',
] as const;

/**
 * The row well: the dark surface behind the rows, below the header. Rows cover it; the edge fades
 * reveal it, so rows fade into the well rather than into the lighter panel. Painted on the root, so
 * it never scrolls. `top-11` clears the root's inset plus the `h-10` header.
 */
const dataListWellStyles =
  "before:pointer-events-none before:absolute before:inset-1 before:rounded-lg before:bg-background before:content-[''] has-[.data-list-top]:before:top-11";

/**
 * Scrollbars sit beside the rows: below the header and clear of the rounded corners, instead of
 * along the panel's edge. Base UI positions them inline, hence `!`.
 */
const dataListScrollbarStyles = [
  '[&>[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:top-2! has-[.data-list-top]:[&>[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:top-12! [&>[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:right-1.5! [&>[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:bottom-2!',
  '[&>[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:right-2! [&>[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:bottom-1.5! [&>[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:left-2!',
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
  scrollable = true,
  mask,
  scrollRef,
  reorder,
  maxHeight,
  autoScroll,
  scrollButtons,
  revealScrollbarOnHover,
  ...props
}: DataListBaseProps) {
  const scopeId = useId();
  const fades = resolveDataListMask(mask);
  const gridStyle: DataListRootStyle = {
    '--data-list-background': dataListVariantBackground[variant],
    ...(fades.top && { '--data-list-fade-top': fades.top }),
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

  const grid = (
    <div
      // Lists scroll inside the ScrollArea viewport (below); the grid just lays out.
      // `isolate` keeps each row's negative-z surface and hover layers above the list's own background.
      className={cn(
        'relative isolate grid content-start',
        ...dataListGridStyles,
        scrollable && fades.top && dataListTopFadeStyles,
        dataListFitClasses[fit],
      )}
      style={gridStyle}
      data-data-list={reorder.reorderable ? scopeId : undefined}
    >
      {orderRules && <style>{orderRules}</style>}
      {children}
    </div>
  );

  if (!scrollable) {
    return (
      // Preserve Base UI's render/style/ref contract without adding a clipping viewport.
      <ScrollAreaPrimitive.Root
        {...props}
        className={cn('w-full rounded-xl p-1', dataListVariantClasses[variant], className)}
      >
        <DataListReorderContext.Provider value={reorder}>{grid}</DataListReorderContext.Provider>
      </ScrollAreaPrimitive.Root>
    );
  }

  // DataList uses the DS ScrollArea: an overlay scrollbar, so the sticky header
  // spans the full width, and the header scrolls sideways with the rows for free.
  // Horizontal overscroll is off: a bounce would drag the sticky header along and expose
  // the panel behind the content. Vertical overscroll chains, so the list never traps the page's wheel.
  return (
    <ScrollArea
      {...props}
      maxHeight={maxHeight}
      autoScroll={autoScroll}
      scrollButtons={scrollButtons}
      revealScrollbarOnHover={revealScrollbarOnHover}
      orientation="both"
      mask={fades.area}
      // Outer radius = row radius (8px) + 4px inset so the corners stay concentric.
      // Size to content but never exceed the parent. Flex (unlike grid `1fr`) lays
      // items out against the max-height-clamped container, so short lists stay
      // compact and long ones shrink the viewport and scroll. `self-start` stops
      // a grid/flex parent from stretching the root to the full row height.
      className={cn(
        'flex max-h-full w-full flex-col self-start rounded-xl p-1',
        dataListVariantClasses[variant],
        variant === 'default' && dataListWellStyles,
        dataListScrollbarStyles,
        className,
      )}
    >
      <ScrollAreaViewport
        ref={scrollRef}
        className={cn(
          // `relative` lifts the content above the well. `rounded-lg` (the root's 12px less its 4px
          // inset) clips the square header corners that otherwise cut into the panel's rim.
          'relative min-h-0 flex-1 basis-auto overscroll-x-none rounded-lg',
          // A pinned column draws its own edge (the divider), so nothing fades on the left.
          'has-[.data-list-sticky-start]:[--scroll-area-fade-left:0px]!',
        )}
      >
        <DataListReorderContext.Provider value={reorder}>{grid}</DataListReorderContext.Provider>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
