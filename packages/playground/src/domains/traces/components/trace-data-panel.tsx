import type { SpanRecord } from '@mastra/core/storage';
import { Button, ButtonWithTooltip, DataKeysAndValues, DataPanel, Icon, ButtonsGroup } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { CircleGaugeIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, SaveIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllSpanIds } from '../hooks/get-all-span-ids';
import { useTraceSpans } from '../hooks/use-trace-spans';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceTimeline } from './trace-timeline';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';

export interface TraceDataPanelProps {
  traceId: string;
  onClose: () => void;
  onSpanSelect?: (span: SpanRecord | undefined) => void;
  onEvaluateTrace?: () => void;
  initialSpanId?: string | null;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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
}: TraceDataPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const contentRef = useRef<HTMLDivElement>(null);
  const { data: traceData, isLoading } = useTraceSpans(traceId);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId ?? undefined);

  // Sync selected span when initialSpanId or trace data changes
  useEffect(() => {
    if (initialSpanId && traceData?.spans) {
      const span = traceData.spans.find(s => s.spanId === initialSpanId);
      if (span) {
        setSelectedSpanId(initialSpanId);
        onSpanSelect?.(span);
        return;
      }
    }
    // Clear stale selection when initialSpanId is null/missing or span not found
    setSelectedSpanId(undefined);
    onSpanSelect?.(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpanId, traceData?.spans]);

  // Scroll the selected span into view within the timeline
  useEffect(() => {
    if (!selectedSpanId || !contentRef.current) return;
    const el = contentRef.current.querySelector(`[data-span-id="${selectedSpanId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedSpanId]);

  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(traceData?.spans ?? []), [traceData?.spans]);

  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (hierarchicalSpans.length > 0) {
      setExpandedSpanIds(getAllSpanIds(hierarchicalSpans));
    }
  }, [hierarchicalSpans]);

  const rootSpan = useMemo(() => traceData?.spans?.find(s => s.parentSpanId == null), [traceData?.spans]);
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);

  const handleSpanClick = (id: string) => {
    const newId = selectedSpanId === id ? undefined : id;
    setSelectedSpanId(newId);
    const span = newId ? traceData?.spans?.find(s => s.spanId === newId) : undefined;
    onSpanSelect?.(span);
  };

  const KV = DataKeysAndValues;

  return (
    <>
      <DataPanel collapsed={collapsed}>
        <DataPanel.Header>
          <DataPanel.Heading>
            Trace <b># {traceId}</b>
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
            <DataPanel.CloseButton onClick={onClose} />
          </ButtonsGroup>
        </DataPanel.Header>

        {!collapsed &&
          (isLoading ? (
            <DataPanel.LoadingData>Loading trace...</DataPanel.LoadingData>
          ) : hierarchicalSpans.length === 0 ? (
            <DataPanel.NoData>No spans found for this trace.</DataPanel.NoData>
          ) : (
            <DataPanel.Content ref={contentRef}>
              {rootSpan && (
                <KV className="mb-6" numOfCol={2}>
                  {rootSpan.entityId && (
                    <>
                      <KV.Key>Entity Id</KV.Key>
                      <KV.Value>{rootSpan.entityName || rootSpan.entityId}</KV.Value>
                    </>
                  )}
                  {rootSpan.entityType && (
                    <>
                      <KV.Key>Entity Type</KV.Key>
                      <KV.Value>{rootSpan.entityType}</KV.Value>
                    </>
                  )}
                  <KV.Key>Status</KV.Key>
                  <KV.Value>{(rootSpan.attributes?.status as string) || '-'}</KV.Value>
                  {rootSpan.startedAt && rootSpan.endedAt && (
                    <>
                      <KV.Key>Duration</KV.Key>
                      <KV.Value>{`${(new Date(rootSpan.endedAt).getTime() - new Date(rootSpan.startedAt).getTime()).toLocaleString()}ms`}</KV.Value>
                    </>
                  )}
                  {rootSpan.startedAt && (
                    <>
                      <KV.Key>Started at</KV.Key>
                      <KV.Value>{format(new Date(rootSpan.startedAt), 'MMM dd, h:mm:ss.SSS aaa')}</KV.Value>
                    </>
                  )}
                  {rootSpan.endedAt && (
                    <>
                      <KV.Key>Ended at</KV.Key>
                      <KV.Value>{format(new Date(rootSpan.endedAt), 'MMM dd, h:mm:ss.SSS aaa')}</KV.Value>
                    </>
                  )}
                </KV>
              )}

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

              <TraceTimeline
                hierarchicalSpans={hierarchicalSpans}
                onSpanClick={handleSpanClick}
                selectedSpanId={selectedSpanId}
                expandedSpanIds={expandedSpanIds}
                setExpandedSpanIds={setExpandedSpanIds}
              />
            </DataPanel.Content>
          ))}
      </DataPanel>

      <TraceAsItemDialog
        traceDetails={rootSpan}
        traceId={traceId}
        isOpen={datasetDialogOpen}
        onClose={() => setDatasetDialogOpen(false)}
      />
    </>
  );
}
