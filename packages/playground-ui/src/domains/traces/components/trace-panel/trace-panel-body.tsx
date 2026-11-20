import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Group, Panel, useGroupRef } from 'react-resizable-panels';
import type { Layout } from 'react-resizable-panels';

import { useTracePanel } from './trace-panel-context';
import { useScrollToFirstHighlight } from '@/hooks/use-scroll-to-first-highlight';
import { useTextHighlight } from '@/hooks/use-text-highlight';
import { PanelSeparator } from '@/lib/resize/separator';

/** Column widths in pixels, persisted per trace entity type. */
type TraceColumnWidths = { side?: number; span?: number };

const pixelWidth = (value: unknown) => (typeof value === 'number' && value > 0 ? value : undefined);

// localStorage access throws when storage is blocked (privacy modes, sandboxed iframes) and stored
// values may be corrupted; fall back to the default widths instead of crashing the panel.
function readColumnWidths(key: string): TraceColumnWidths {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!stored || typeof stored !== 'object') return {};
    return {
      side: pixelWidth('side' in stored ? stored.side : undefined),
      span: pixelWidth('span' in stored ? stored.span : undefined),
    };
  } catch {
    return {};
  }
}

function writeColumnWidths(key: string, widths: TraceColumnWidths) {
  try {
    localStorage.setItem(key, JSON.stringify(widths));
  } catch {
    // Persisting is best-effort.
  }
}

export interface TracePanelBodyProps {
  /** The resizable column on the left, typically a `TracePanel.Side`. */
  side?: ReactNode;
  /** The column in the middle, typically a `TracePanel.Main`; it takes the room the others leave. */
  main: ReactNode;
  /** The resizable column on the right, shown while a span is open; typically a `TracePanel.SpanDetail`. */
  span?: ReactNode;
}

/**
 * Lays its slots out side by side: side, main, span. The side and span columns are resizable (down to a
 * minimum width) and keep their pixel width when the drawer resizes, remembered per trace entity type; the
 * main column takes the rest. Search matches are highlighted across every column while a query is active,
 * and the first match in the span column is brought into view when it opens.
 */
export function TracePanelBody({ side, main, span }: TracePanelBodyProps) {
  const { query, layoutKey, selectedSpanId } = useTracePanel();
  // A single hook call on the common ancestor covers both the span tree and the span detail, so span
  // names and payload values highlight together.
  const { ref: highlightRef } = useTextHighlight<HTMLDivElement>(query);
  // Scoped to the span column only: a match deep in a large payload sits below the fold, and the
  // span tree must never be scrolled by this.
  const { ref: scrollToMatchRef } = useScrollToFirstHighlight<HTMLDivElement>(query, selectedSpanId);
  const showSpan = !!span && !!selectedSpanId;

  // The side and span columns are sized in pixels: they keep their width when the drawer resizes
  // (it widens when a span opens) and when the span column comes and goes; only the main column in
  // the middle absorbs the change. The library lays panels out in percentages, so the pixel widths
  // are owned here.
  const groupRef = useGroupRef();
  const columnsRef = useRef<HTMLDivElement>(null);
  const storageKey = layoutKey ? `mastra:trace-panel-widths:${layoutKey}` : undefined;
  const widths = useRef<{ key?: string; value: TraceColumnWidths }>({ value: {} });
  if (widths.current.key !== storageKey) {
    widths.current = { key: storageKey, value: storageKey ? readColumnWidths(storageKey) : {} };
  }
  // Only agent traces have messages worth reading side by side with the spans; for every other
  // entity the side column starts narrow so the span tree gets the room.
  const sideWidth = () => widths.current.value.side ?? (layoutKey === 'agent' ? 480 : 320);
  const spanWidth = () => widths.current.value.span ?? 480;

  const panelElements = () =>
    Array.from(columnsRef.current?.querySelectorAll<HTMLElement>(':scope > [data-panel]') ?? []);

  // Only a resize the user makes is remembered: layout changes from the drawer resizing or a
  // column mounting are derived from the stored widths and must not drift them.
  const userResizing = useRef(false);
  const markUserResize = (event: { target: EventTarget }) => {
    if (event.target instanceof Element && event.target.closest('[data-separator]')) userResizing.current = true;
  };
  const persistWidths = (layout: Layout) => {
    if (!userResizing.current) return;
    userResizing.current = false;
    const width = (id: string) =>
      id in layout
        ? pixelWidth(Math.round(panelElements().find(panel => panel.id === id)?.offsetWidth ?? 0))
        : undefined;
    widths.current.value = {
      side: width('trace-side') ?? widths.current.value.side,
      span: width('trace-span') ?? widths.current.value.span,
    };
    if (storageKey) writeColumnWidths(storageKey, widths.current.value);
  };

  // The library re-lays panels out on its own — when the drawer resizes, when a column mounts or
  // unmounts — so every layout it reports is brought back to the pixel widths, unless the user is
  // dragging a separator. The layout it settles on after clamping to min sizes is left alone,
  // including the one it reports from inside our own setLayout: when the columns can't fit, rounding
  // makes each clamped layout differ from the last, and answering it would re-lay out forever.
  const settledLayout = useRef<Layout | undefined>(undefined);
  const applyingLayout = useRef(false);
  const holdPixelWidths = (layout: Layout) => {
    if (userResizing.current || applyingLayout.current) return;
    const group = groupRef.current;
    const ids = Object.keys(layout);
    // The library sizes panels against their summed width, separators excluded.
    const total = panelElements()
      .filter(panel => ids.includes(panel.id))
      .reduce((sum, panel) => sum + panel.offsetWidth, 0);
    if (!group || total === 0 || !ids.includes('trace-main')) return;
    const side = ids.includes('trace-side') ? (sideWidth() / total) * 100 : 0;
    const span = ids.includes('trace-span') ? (spanWidth() / total) * 100 : 0;
    const target: Layout = { 'trace-main': 100 - side - span };
    if (side) target['trace-side'] = side;
    if (span) target['trace-span'] = span;
    const tolerance = (0.5 / total) * 100;
    const matches = (a: Layout, b?: Layout) =>
      !!b && ids.every(id => Math.abs((a[id] ?? 0) - (b[id] ?? Infinity)) < tolerance);
    if (matches(layout, target) || matches(layout, settledLayout.current)) return;
    queueMicrotask(() => {
      applyingLayout.current = true;
      try {
        settledLayout.current = group.setLayout(target);
      } finally {
        applyingLayout.current = false;
      }
    });
  };

  return (
    <div
      ref={highlightRef}
      data-trace-columns
      className="flex min-h-0 flex-1"
      onPointerDownCapture={markUserResize}
      onKeyDownCapture={markUserResize}
    >
      {/* Plain Group, not PanelGroup: its flex-grow transition would lag behind the drawer
            resizing and make the pixel-sized columns visibly stretch. */}
      <Group
        // Default sizes are only read on mount: remount once the entity type is known.
        key={layoutKey ?? 'unknown'}
        groupRef={groupRef}
        elementRef={columnsRef}
        orientation="horizontal"
        className="min-h-0 flex-1"
        onLayoutChange={holdPixelWidths}
        onLayoutChanged={persistWidths}
      >
        {side && (
          <>
            <Panel id="trace-side" minSize={280} defaultSize={sideWidth()} groupResizeBehavior="preserve-pixel-size">
              <div className="flex h-full min-h-0 flex-col border-r border-surface-rim">{side}</div>
            </Panel>
            <PanelSeparator variant="pill" />
          </>
        )}
        {/* 384px: the timeline grid's own minimum (two 12rem columns), so its end never clips. */}
        <Panel id="trace-main" minSize={384} className="flex min-h-0 min-w-0 flex-col">
          {main}
        </Panel>
        {showSpan && (
          <>
            <PanelSeparator variant="pill" />
            <Panel
              id="trace-span"
              minSize={384}
              maxSize="50%"
              defaultSize={spanWidth()}
              groupResizeBehavior="preserve-pixel-size"
            >
              <div
                ref={scrollToMatchRef}
                data-highlight
                className="flex h-full min-h-0 animate-in flex-col border-l border-surface-rim duration-300 fade-in-0"
              >
                {span}
              </div>
            </Panel>
          </>
        )}
      </Group>
    </div>
  );
}
