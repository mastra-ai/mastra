import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { TraceNavigation } from '../trace-navigation';
import { TraceNavigationScope } from '../trace-navigation-scope';
import { getTraceRootSpan } from '../trace-thread-context';
import { TracePanelContext } from './trace-panel-context';
import type { TracePanelContextValue, TracePanelSpan, TraceSpanView } from './trace-panel-context';

export interface TracePanelRootProps {
  /** Keep the panel mounted and pass `undefined` to close it, so the drawer animates out. */
  traceId?: string;
  /** The trace's spans (light records are enough), as the host loaded them. */
  spans: TracePanelSpan[] | undefined;
  isLoading?: boolean;
  /**
   * Span treated as the displayed root of the tree: required for a branch, whose anchor has a parent
   * outside `spans`. Omitted, the span without a parent is the root.
   */
  anchorSpanId?: string;
  /**
   * Root entity type when the host knows it before the spans load (e.g. from a listed row), so the
   * columns are sized from the start. `null` is a trace known to have no entity type.
   */
  entityType?: string | null;
  /**
   * The span the host asks to open (e.g. from the URL). Kept until the spans load, then dropped through
   * `onSpanSelect(undefined)` when the trace has no such span.
   */
  selectedSpanId?: string | null;
  onSpanSelect?: (spanId: string | undefined) => void;
  /** Controlled span search query; the root keeps its own when omitted. */
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Controlled span layout (tree or timeline); starts on the tree when omitted. */
  spanView?: TraceSpanView;
  onSpanViewChange?: (view: TraceSpanView) => void;
  /** Controlled side column view; `TracePanel.Side` falls back to its first view when this trace has no such view. */
  sideView?: string;
  onSideViewChange?: (view: string) => void;
  /** Closes the panel (`TracePanel.CloseButton`, Escape or the backdrop of `TracePanel.Frame`). */
  onClose: () => void;
  /**
   * Where the panel opens things (the entity, the trace page, tools, delegated agents and workflows,
   * workspaces, Knowledge pages): the host's callbacks. A part with no callback shows as text.
   */
  navigation?: TraceNavigation;
  /** Typically a `TracePanel.Frame`. */
  children?: ReactNode;
}

/**
 * The state the parts of a trace panel share: the trace and its spans, the open span, the search, the
 * span layout, the side view and the scoring dialog. It renders no markup of its own (`TracePanel.Frame`
 * draws the drawer) and never fetches: each part draws the records the host hands it, so the panel is
 * composed the same way whatever loads the data.
 */
export function TracePanelRoot({
  traceId,
  spans,
  isLoading = false,
  anchorSpanId,
  entityType,
  selectedSpanId: requestedSpanId,
  onSpanSelect,
  searchQuery,
  onSearchQueryChange,
  spanView: controlledSpanView,
  onSpanViewChange,
  sideView: controlledSideView,
  onSideViewChange,
  onClose,
  navigation,
  children,
}: TracePanelRootProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(requestedSpanId ?? undefined);
  // Sync the open span when the host asks for another one or the trace data changes.
  useEffect(() => {
    // No span requested: clear immediately.
    if (!requestedSpanId) {
      setSelectedSpanId(undefined);
      onSpanSelect?.(undefined);
      return;
    }
    // Span requested: wait for trace data before deciding so an in-flight fetch doesn't wipe a
    // URL-provided selection. Hosts that default their spans to `[]` while loading only say so through `isLoading`.
    if (isLoading || !spans) return;

    const found = spans.find(span => span.spanId === requestedSpanId);
    setSelectedSpanId(found ? requestedSpanId : undefined);
    onSpanSelect?.(found ? requestedSpanId : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSpanId, spans, isLoading]);

  const [ownQuery, setOwnQuery] = useState('');
  const [ownSpanView, setOwnSpanView] = useState<TraceSpanView>('tree');
  const [ownSideView, setOwnSideView] = useState<string>();
  const [isScoring, setScoring] = useState(false);

  const rootSpan = getTraceRootSpan(spans, anchorSpanId);
  const layoutKey = rootSpan ? (rootSpan.entityType ?? 'unknown') : entityType === null ? 'unknown' : entityType;

  const value: TracePanelContextValue = {
    traceId: traceId ?? '',
    spans,
    isLoading,
    anchorSpanId,
    rootSpan,
    layoutKey,
    selectedSpanId,
    selectSpan: spanId => {
      setSelectedSpanId(spanId);
      onSpanSelect?.(spanId);
    },
    query: searchQuery ?? ownQuery,
    setQuery: query => {
      setOwnQuery(query);
      onSearchQueryChange?.(query);
    },
    spanView: controlledSpanView ?? ownSpanView,
    setSpanView: view => {
      setOwnSpanView(view);
      onSpanViewChange?.(view);
    },
    sideView: controlledSideView ?? ownSideView,
    setSideView: view => {
      setOwnSideView(view);
      onSideViewChange?.(view);
    },
    isScoring,
    setScoring,
    onClose,
  };

  return (
    <TracePanelContext.Provider value={value}>
      <TraceNavigationScope navigation={navigation}>{children}</TraceNavigationScope>
    </TracePanelContext.Provider>
  );
}
