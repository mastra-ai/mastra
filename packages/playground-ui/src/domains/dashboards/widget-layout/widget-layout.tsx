import { GripHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { setWidgetDragData, WIDGET_DRAG_TYPE } from './drag-data';
import { canInsertAt, insertWidget, LAYOUT_COLUMNS, moveWidget, resizeOptions, resizeWidgets } from './layout';
import type { WidgetDropTarget, WidgetLayoutItem, WidgetLayoutRow } from './layout';
import { useSlotAnimations } from './use-slot-animations';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

function isWidgetDrag(event: DragEvent) {
  return event.dataTransfer.types.includes(WIDGET_DRAG_TYPE);
}

export type WidgetLayoutChange = { type: 'insert' | 'move' | 'resize'; widgetId: string };

export type WidgetLayoutProps = {
  rows: WidgetLayoutRow[];
  onRowsChange: (rows: WidgetLayoutRow[], change: WidgetLayoutChange) => void;
  renderWidget: (widget: WidgetLayoutItem) => ReactNode;
  className?: string;
};

/** `widgetId` is the widget being moved, or `null` for a new widget dragged in from outside. */
type DragState = { widgetId: string | null };

/**
 * Rows of widgets on 12 columns, each row always filled. Drag a widget by its handle into a gap; a
 * line shows where it lands: a horizontal one puts it on a new row, a vertical one slots it into that row. The handle
 * between two widgets trades columns between them.
 */
export function WidgetLayout({ rows, onRowsChange, renderWidget, className }: WidgetLayoutProps) {
  const [drag, setDrag] = useState<DragState>();
  const dragging = drag !== undefined;
  const layoutRef = useRef<HTMLDivElement>(null);
  useSlotAnimations(layoutRef, rows);

  // A drop or a cancelled drag ends wherever the pointer is, often outside the layout.
  useEffect(() => {
    if (!dragging) return;
    const end = () => setDrag(undefined);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    return () => {
      document.removeEventListener('dragend', end);
      document.removeEventListener('drop', end);
    };
  }, [dragging]);

  const accepts = (target: WidgetDropTarget) =>
    drag?.widgetId ? moveWidget(rows, drag.widgetId, target) !== undefined : canInsertAt(rows, target);

  const drop = (target: WidgetDropTarget) => (event: DragEvent) => {
    setDrag(undefined);
    const widgetId = event.dataTransfer.getData(WIDGET_DRAG_TYPE);
    if (!widgetId) return;
    const moving = rows.some(r => r.widgets.some(w => w.id === widgetId));
    const next = moving ? moveWidget(rows, widgetId, target) : insertWidget(rows, widgetId, target);
    if (next) onRowsChange(next, { type: moving ? 'move' : 'insert', widgetId });
  };

  const resize = (rowIndex: number, leftIndex: number, leftSpan: number) => {
    const next = resizeWidgets(rows, rowIndex, leftIndex, leftSpan);
    const widget = rows[rowIndex]?.widgets[leftIndex];
    if (next && widget) onRowsChange(next, { type: 'resize', widgetId: widget.id });
  };

  const rowZone = (rowIndex: number) => {
    const target: WidgetDropTarget = { type: 'row', rowIndex };
    return (
      <div
        key={`row-zone-${rowIndex}`}
        className="relative h-4"
        style={{ gridRow: rowIndex * 2 + 1, gridColumn: '1 / -1' }}
      >
        {dragging && accepts(target) && (
          <DropZone orientation="horizontal" className="inset-x-0 -inset-y-2" onDrop={drop(target)} />
        )}
      </div>
    );
  };

  const slotZone = (rowIndex: number, index: number, side: 'before' | 'after') => {
    const target: WidgetDropTarget = { type: 'slot', rowIndex, index };
    if (!dragging || !accepts(target)) return null;
    // Centred on the gap (or the layout's padding) beside the widget.
    const position = side === 'before' ? '-left-6' : '-right-6';
    return <DropZone orientation="vertical" className={cn('inset-y-0 w-8', position)} onDrop={drop(target)} />;
  };

  const cells: ReactNode[] = [];
  rows.forEach((row, rowIndex) => {
    cells.push(rowZone(rowIndex));
    let column = 1;
    row.widgets.forEach((widget, index) => {
      const next = row.widgets[index + 1];
      const isLast = next === undefined;
      const leftSpans = resizeOptions(row.widgets, index);
      cells.push(
        <WidgetSlot
          key={widget.id}
          widget={widget}
          style={{ gridRow: rowIndex * 2 + 2, gridColumn: `${column} / span ${widget.span}` }}
          moving={drag?.widgetId === widget.id}
          onDragStart={() => setDrag({ widgetId: widget.id })}
          content={renderWidget(widget)}
        >
          {slotZone(rowIndex, index, 'before')}
          {isLast && slotZone(rowIndex, index + 1, 'after')}
          {!isLast && !dragging && (
            <ResizeHandle
              leftSpan={widget.span}
              leftSpans={leftSpans}
              onResize={span => resize(rowIndex, index, span)}
            />
          )}
        </WidgetSlot>,
      );
      column += widget.span;
    });
  });
  cells.push(rowZone(rows.length));

  return (
    <div
      ref={layoutRef}
      data-widget-layout=""
      className={cn('group/layout grid grid-cols-12 gap-x-4 px-4', className)}
      onDragEnter={event => {
        if (!dragging && isWidgetDrag(event)) setDrag({ widgetId: null });
      }}
      onDragLeave={event => {
        if (drag?.widgetId === null && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDrag(undefined);
        }
      }}
    >
      {rows.length === 0 ? <EmptyLayout dragging={dragging} onDrop={drop({ type: 'row', rowIndex: 0 })} /> : cells}
    </div>
  );
}

type WidgetSlotProps = {
  widget: WidgetLayoutItem;
  style: CSSProperties;
  moving: boolean;
  onDragStart: () => void;
  /** The widget itself, stretched to fill the cell. */
  content: ReactNode;
  /** Drop zones and resize handle, positioned against the cell's edges. */
  children: ReactNode;
};

function WidgetSlot({ widget, style, moving, onDragStart, content, children }: WidgetSlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: DragEvent<HTMLButtonElement>) => {
    setWidgetDragData(event.dataTransfer, widget.id);
    const slot = slotRef.current;
    if (slot) {
      const rect = slot.getBoundingClientRect();
      event.dataTransfer.setDragImage(slot, event.clientX - rect.left, event.clientY - rect.top);
    }
    // Showing the drop zones in the same frame changes the DOM under the drag and Chrome cancels it.
    requestAnimationFrame(onDragStart);
  };

  return (
    <div
      ref={slotRef}
      data-widget-slot={widget.id}
      data-span={widget.span}
      style={style}
      className={cn(
        'group/slot relative min-w-0 transition-opacity duration-fast motion-reduce:transition-none',
        moving && 'opacity-40',
      )}
    >
      <div className="h-full min-w-0 *:size-full *:min-w-0!">{content}</div>
      <Button
        size="icon-sm"
        aria-label="Move widget"
        draggable
        onDragStart={startDrag}
        className="absolute top-1 left-1/2 z-10 -translate-x-1/2 cursor-grab opacity-0 group-hover/slot:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripHorizontal />
      </Button>
      {children}
    </div>
  );
}

type DropZoneProps = {
  orientation: 'horizontal' | 'vertical';
  className: string;
  onDrop: (event: DragEvent) => void;
};

/** An invisible hit area that shows a gray line only while a widget is dragged over it. */
function DropZone({ orientation, className, onDrop }: DropZoneProps) {
  const [over, setOver] = useState(false);
  return (
    <div
      data-drop-zone={orientation}
      className={cn('absolute z-20 flex items-center justify-center', className)}
      onDragEnter={event => {
        if (isWidgetDrag(event)) setOver(true);
      }}
      onDragOver={event => {
        if (!isWidgetDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault();
        setOver(false);
        onDrop(event);
      }}
    >
      <div
        className={cn(
          'pointer-events-none rounded-full bg-border-strong transition-opacity duration-fast motion-reduce:transition-none',
          orientation === 'horizontal' ? 'h-1 w-full' : 'h-full w-1',
          over ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

type ResizeHandleProps = {
  leftSpan: number;
  /** The spans the left widget can take, narrowest first; the widgets after it share the rest. */
  leftSpans: number[];
  onResize: (leftSpan: number) => void;
};

/**
 * Sits in the gap after a widget. Dragging it left shrinks the widget on its left and grows the ones
 * on its right, snapping to the nearest span the row can store; arrow keys step through the spans.
 * When the boundary has nowhere else to go (two widgets can only split a row 6 + 6) it stays visible
 * but inert.
 */
function ResizeHandle({ leftSpan, leftSpans, onResize }: ResizeHandleProps) {
  const start = useRef<{ x: number; span: number; column: number }>(null);
  const [resizing, setResizing] = useState(false);
  const fixed = leftSpans.length < 2;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const layout = event.currentTarget.closest<HTMLElement>('[data-widget-layout]');
    if (fixed || !layout) return;
    event.preventDefault();
    const style = getComputedStyle(layout);
    const gap = parseFloat(style.columnGap) || 0;
    const width = layout.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    start.current = { x: event.clientX, span: leftSpan, column: (width + gap) / LAYOUT_COLUMNS };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const columns = Math.round((event.clientX - start.current.x) / start.current.column);
    if (start.current.span + columns !== leftSpan) onResize(start.current.span + columns);
  };

  const stop = () => {
    start.current = null;
    setResizing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = leftSpans.indexOf(leftSpan);
    const span = {
      ArrowLeft: leftSpans[current - 1],
      ArrowRight: leftSpans[current + 1],
      Home: leftSpans[0],
      End: leftSpans.at(-1),
    }[event.key];
    if (span === undefined) return;
    event.preventDefault();
    onResize(span);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize widgets"
      aria-valuemin={leftSpans[0]}
      aria-valuemax={leftSpans.at(-1)}
      aria-valuenow={leftSpan}
      aria-disabled={fixed || undefined}
      tabIndex={fixed ? -1 : 0}
      className={cn(
        'group/handle absolute inset-y-0 -right-4 z-10 flex w-4 touch-none items-center justify-center rounded-full select-none',
        fixed ? 'cursor-not-allowed' : 'cursor-col-resize',
        focusRing,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={onKeyDown}
    >
      <div
        className={cn(
          'h-8 w-1 rounded-full transition-[opacity,background-color] duration-fast motion-reduce:transition-none',
          resizing
            ? 'bg-info-indicator opacity-100'
            : fixed
              ? 'bg-border opacity-0 group-hover/layout:opacity-100'
              : 'bg-border-strong opacity-0 group-hover/handle:bg-info-indicator group-hover/layout:opacity-100 group-focus-visible/handle:opacity-100',
        )}
      />
    </div>
  );
}

function EmptyLayout({ dragging, onDrop }: { dragging: boolean; onDrop: (event: DragEvent) => void }) {
  return (
    <div className="relative col-span-full my-4 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border">
      <Txt variant="body-sm" tone="muted">
        Drag a widget here
      </Txt>
      {dragging && <DropZone orientation="horizontal" className="inset-0 px-4" onDrop={onDrop} />}
    </div>
  );
}
