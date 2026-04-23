import { Button, ButtonWithTooltip, DataPanel, Icon, ButtonsGroup, truncateString } from '@mastra/playground-ui';
import { CircleGaugeIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, Link2Icon, SaveIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useTraceLightSpans } from '../hooks/use-trace-light-spans';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceKeysAndValues } from './trace-keys-and-values';
import { TraceTimeline } from './trace-timeline';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { Link } from '@/lib/link';

export type TraceDataPanelPlacement = 'traces-list' | 'trace-page';

export interface TraceDataPanelProps {
  traceId: string;
  onClose: () => void;
  onSpanSelect?: (spanId: string | undefined) => void;
  onEvaluateTrace?: () => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  placement: TraceDataPanelPlacement;
  timelineChartWidth?: 'wide' | 'default';
}

export function TraceDataPanel({
  traceId,
  onClose,
  onSpanSelect,
  onEvaluateTrace,
  initialSpanId,
  onPrevious,
  onNext,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  placement,
  timelineChartWidth = 'default',
}: TraceDataPanelProps) {
  const isOnTracePage = placement === 'trace-page';
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const contentRef = useRef<HTMLDivElement>(null);
  const { data: traceLight, isLoading } = useTraceLightSpans(traceId);
  const spans = traceLight?.spans;
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
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    onSpanSelect?.(newId);
  };

  return (
    <>
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
                {!isOnTracePage && (
                  <ButtonWithTooltip
                    as={Link}
                    href={`/traces/${traceId}`}
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

              {!isOnTracePage && (
                <div className="mb-6 flex justify-between items-center gap-4">
                  {onEvaluateTrace && (
                    <Button size="sm" onClick={onEvaluateTrace}>
                      <Icon>
                        <CircleGaugeIcon />
                      </Icon>
                      Evaluate Trace
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setDatasetDialogOpen(true)}>
                    <Icon>
                      <SaveIcon />
                    </Icon>
                    Save as Dataset Item
                  </Button>
                </div>
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

      <TraceAsItemDialog
        rootSpanId={rootSpan?.spanId}
        traceId={traceId}
        isOpen={datasetDialogOpen}
        onClose={() => setDatasetDialogOpen(false)}
      />
    </>
  );
}
