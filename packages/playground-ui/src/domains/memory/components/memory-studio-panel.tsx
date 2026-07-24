import { ArrowLeftIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Txt } from '../../../ds/components/Txt';
import { MemoryIcon } from '../../../ds/icons/MemoryIcon';
import { extractOmMarkers } from '../lib/extract-markers';
import { findRecordIdAtOrBefore, getObservationTimestampMs } from '../lib/replay-selection';
import { getLatestThreadContextWindowState } from '../lib/thread-context-window-state';
import { timestampsToTDomain } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';
import { FlameGraph } from './flame-graph';
import type { ZoomRange } from './flame-graph';
import { ObservationDetailView } from './observation-detail-view';
import { ThreadContextProgress } from './thread-context-progress';

export interface MemoryStudioPanelProps {
  messages: MemoryMessage[];
  omRecords: OMHistoryRecord[];
  isLoading?: boolean;
  onClose?: () => void;
  /** Replay cursor (ms epoch) driven by the timeline; selects the matching observation. */
  selectedTimestamp?: number | null;
  /** Fired when the flame graph timeline is clicked, surfacing the replay cursor. */
  onSelectTimestamp?: (timestamp: number | null) => void;
  /**
   * Authoritative context-window token counts/thresholds supplied by the caller
   * (e.g. derived from the OM record + live stream progress). When provided these
   * take precedence over the values re-derived from message markers, keeping this
   * panel aligned with the OM sidebar. Marker-derived values remain the fallback
   * for standalone usage.
   */
  contextWindow?: {
    messageTokens?: number;
    messageThreshold?: number;
    memoryTokens?: number;
    memoryThreshold?: number;
  };
}

export function MemoryStudioPanel({
  messages,
  omRecords,
  isLoading = false,
  onClose,
  selectedTimestamp,
  onSelectTimestamp,
  contextWindow,
}: MemoryStudioPanelProps) {
  const [manualOMRecordId, setManualOMRecordId] = useState<string | null>(null);

  const markers = useMemo(() => extractOmMarkers(messages), [messages]);
  const tDomain = useMemo(() => {
    if (messages.length === 0) return { tMin: 0, tMax: 1 };
    return timestampsToTDomain(messages.map(m => new Date(m.createdAt).toISOString()));
  }, [messages]);
  const windowState = useMemo(() => getLatestThreadContextWindowState({ markers, omRecords }), [markers, omRecords]);

  const memoryTokens = contextWindow?.memoryTokens ?? windowState?.memoryTokens;
  const memoryThreshold = contextWindow?.memoryThreshold ?? windowState?.memoryThreshold;

  // Zoom range (epoch ms) is owned here so it can both scope the FlameGraph
  // charts and filter the observation list. It resets to the full domain
  // whenever the domain changes (mirrors the FlameGraph's own reset behaviour).
  const [zoomRange, setZoomRange] = useState<ZoomRange>({ left: tDomain.tMin, right: tDomain.tMax });
  useEffect(() => {
    setZoomRange({ left: tDomain.tMin, right: tDomain.tMax });
  }, [tDomain.tMin, tDomain.tMax]);

  // The full-domain case is a strict pass-through so an untouched range never
  // hides records (e.g. observations outside the message-derived domain).
  const isFullRange = zoomRange.left <= tDomain.tMin && zoomRange.right >= tDomain.tMax;
  const visibleRecords = useMemo(() => {
    if (isFullRange) return omRecords;
    return omRecords.filter(record => {
      const t = getObservationTimestampMs(record);
      return t >= zoomRange.left && t <= zoomRange.right;
    });
  }, [omRecords, isFullRange, zoomRange.left, zoomRange.right]);

  // Replay cursor (controlled) overrides manual history selection. Resolve it
  // against the visible records so selection stays consistent with the list.
  const replayRecordId = useMemo(
    () => (selectedTimestamp != null ? findRecordIdAtOrBefore(visibleRecords, selectedTimestamp) : null),
    [visibleRecords, selectedTimestamp],
  );
  // Ignore a manual selection that the range has filtered out, so the detail
  // view falls back to a record that is actually visible instead of an empty state.
  const manualSelectionInRange =
    manualOMRecordId != null && visibleRecords.some(r => r.id === manualOMRecordId) ? manualOMRecordId : null;
  const selectedOMRecordId = replayRecordId ?? manualSelectionInRange;

  return (
    <div className="flex size-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border1 px-3 py-2.5">
        <Button type="button" variant="ghost" size="icon-sm" tooltip="Back to memory" onClick={() => onClose?.()}>
          <ArrowLeftIcon />
        </Button>
        <span className="flex min-w-0 items-center gap-1.5 text-neutral6">
          <MemoryIcon className="size-4 shrink-0" />
          <Txt as="span" variant="ui-sm" className="font-medium">
            Observational memory
          </Txt>
        </span>
      </div>

      {isLoading ? (
        <div data-testid="memory-studio-loading" className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden">
            <ObservationDetailView
              records={visibleRecords}
              selectedRecordId={selectedOMRecordId}
              onSelectRecord={setManualOMRecordId}
              isLoading={isLoading}
            />
          </div>
          <div className="border-t border-border1">
            <ThreadContextProgress
              messageTokens={contextWindow?.messageTokens ?? windowState?.messageTokens}
              messageThreshold={contextWindow?.messageThreshold ?? windowState?.messageThreshold}
              memoryTokens={memoryTokens}
              memoryThreshold={memoryThreshold}
              memoryLabel="Observations"
            />
            <FlameGraph
              omRecords={omRecords}
              markers={markers}
              messages={messages}
              tDomain={tDomain}
              onSelectTimestamp={onSelectTimestamp}
              zoomRange={zoomRange}
              onZoomRangeChange={setZoomRange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
