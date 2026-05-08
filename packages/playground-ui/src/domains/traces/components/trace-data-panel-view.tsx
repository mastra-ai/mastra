import type { LightSpanRecord } from '@mastra/core/storage';
import { CircleGaugeIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, Link2Icon, SaveIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceKeysAndValues } from './trace-keys-and-values';
import { TraceTimeline } from './trace-timeline';
import { Button, ButtonWithTooltip } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import { Notice } from '@/ds/components/Notice';
import { Icon } from '@/ds/icons/Icon';
import type { LinkComponent } from '@/ds/types/link-component';
import { truncateString } from '@/lib/truncate-string';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export interface TraceDataPanelViewProps {
  traceId: string;
  /** Lightweight spans for the trace. Caller fetches via useTraceLightSpans. */
  spans: LightSpanRecord[] | undefined;
  isLoading?: boolean;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  /** When set, a "Save as Dataset Item" button appears; the consumer owns the dialog. */
  onSaveAsDatasetItem?: (args: { traceId: string; rootSpanId: string | undefined }) => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  placement: TraceDataPanelPlacement;
  timelineChartWidth?: 'wide' | 'default';
  /** When both are provided, renders an "Open trace page" button. */
  LinkComponent?: LinkComponent;
  traceHref?: string;
}

export function TraceDataPanelView({
  traceId,
  spans,
  isLoading,
  onClose,
  onSpanSelect,
  onEvaluateTrace,
  onSaveAsDatasetItem,
  initialSpanId,
  onPrevious,
  onNext,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  placement,
  timelineChartWidth = 'default',
  LinkComponent,
  traceHref,
}: TraceDataPanelViewProps) {
  const isOnTracePage = placement === 'trace-page';
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId ?? undefined);

  // Sync selected span when initialSpanId or trace data changes
  useEffect(() => {
    // No span requested: clear immediately.
    if (!initialSpanId) {
      setSelectedSpanId(undefined);
      onSpanSelect?.(undefined);
      return;
    }
    // Span requested: wait for trace data before deciding so an in-flight
    // fetch doesn't wipe a URL-provided selection.
    if (!spans) return;

    const found = spans.find(s => s.spanId === initialSpanId);
    if (found) {
      setSelectedSpanId(initialSpanId);
      onSpanSelect?.(initialSpanId);
    } else {
      setSelectedSpanId(undefined);
      onSpanSelect?.(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpanId, spans]);

  // Scroll the selected span into view within the timeline
  useEffect(() => {
    if (!selectedSpanId || !contentRef.current) return;
    const el = contentRef.current.querySelector(`[data-span-id="${selectedSpanId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedSpanId]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(spans ?? []), [spans]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const rootSpan = useMemo(() => spans?.find(s => s.parentSpanId == null), [spans]);

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    onSpanSelect?.(newId);
  };

  const showOpenTracePageLink = !isOnTracePage && LinkComponent && traceHref;

  return (
    <DataPanel collapsed={collapsed}>
      <DataPanel.Header>
        {isOnTracePage ? (
          <DataPanel.Heading>Trace Timeline</DataPanel.Heading>
        ) : (
          <>
            <DataPanel.Heading>
              Trace <b># {truncateString(traceId, 12)}</b>
            </DataPanel.Heading>
            <ButtonsGroup className="ml-auto shrink-0">
              {onCollapsedChange && (
                <ButtonWithTooltip
                  size="md"
                  tooltipContent={collapsed ? 'Expand panel' : 'Collapse panel'}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
                </ButtonWithTooltip>
              )}
              <DataPanel.NextPrevNav
                onPrevious={onPrevious}
                onNext={onNext}
                previousLabel="Previous trace"
                nextLabel="Next trace"
              />
              {showOpenTracePageLink && (
                <ButtonWithTooltip
                  as={LinkComponent}
                  href={traceHref}
                  size="md"
                  tooltipContent="Open trace page"
                  aria-label="Open trace page"
                >
                  <Link2Icon />
                </ButtonWithTooltip>
              )}
              <DataPanel.CloseButton onClick={onClose} />
            </ButtonsGroup>
          </>
        )}
      </DataPanel.Header>

      {!collapsed &&
        (isLoading ? (
          <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
        ) : hierarchicalSpans.length === 0 ? (
          <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
        ) : (
          <DataPanel.Content ref={contentRef}>
            {!isOnTracePage && rootSpan && <TraceKeysAndValues rootSpan={rootSpan} className="mb-6" />}

            {!isOnTracePage && (onEvaluateTrace || onSaveAsDatasetItem) && (
              <div className="mb-6 flex justify-between items-center gap-4">
                {onEvaluateTrace && (
                  <Button size="sm" onClick={onEvaluateTrace}>
                    <Icon>
                      <CircleGaugeIcon />
                    </Icon>
                    Evaluate Trace
                  </Button>
                )}
                {onSaveAsDatasetItem && (
                  <Button size="sm" onClick={() => onSaveAsDatasetItem({ traceId, rootSpanId: rootSpan?.spanId })}>
                    <Icon>
                      <SaveIcon />
                    </Icon>
                    Save as Dataset Item
                  </Button>
                )}
              </div>
            )}

            {!isOnTracePage && !onEvaluateTrace && !onSaveAsDatasetItem && (
              <Notice variant="info" className="mb-6">
                <Notice.Message>
                  Evaluating traces and saving them as dataset items is available in Mastra Studio (local or deployed).
                </Notice.Message>
              </Notice>
            )}

            <TraceTimeline
              hierarchicalSpans={hierarchicalSpans}
              onSpanClick={handleSpanClick}
              selectedSpanId={selectedSpanId}
              expandedSpanIds={expandedSpanIds}
              setExpandedSpanIds={setExpandedSpanIds}
              chartWidth={timelineChartWidth}
            />
          </DataPanel.Content>
        ))}
    </DataPanel>
  );
}
