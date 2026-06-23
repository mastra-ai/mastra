import { XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Txt } from '../../../ds/components/Txt';
import { MemoryIcon } from '../../../ds/icons/MemoryIcon';
import { extractOmMarkers } from '../lib/extract-markers';
import { findRecordIdAtOrBefore } from '../lib/replay-selection';
import { getLatestThreadContextWindowState } from '../lib/thread-context-window-state';
import { timestampsToTDomain } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';
import { FlameGraph } from './flame-graph';
import { ObservationDetailView } from './observation-detail-view';
import { ThreadContextProgress, formatCompactTokens } from './thread-context-progress';

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

  // Replay cursor (controlled) overrides manual history selection.
  const replayRecordId = useMemo(
    () => (selectedTimestamp != null ? findRecordIdAtOrBefore(omRecords, selectedTimestamp) : null),
    [omRecords, selectedTimestamp],
  );
  const selectedOMRecordId = replayRecordId ?? manualOMRecordId;

  const markers = useMemo(() => extractOmMarkers(messages), [messages]);
  const tDomain = useMemo(() => {
    if (messages.length === 0) return { tMin: 0, tMax: 1 };
    return timestampsToTDomain(messages.map(m => new Date(m.createdAt).toISOString()));
  }, [messages]);
  const windowState = useMemo(() => getLatestThreadContextWindowState({ markers, omRecords }), [markers, omRecords]);

  const memoryTokens = contextWindow?.memoryTokens ?? windowState?.memoryTokens;
  const memoryThreshold = contextWindow?.memoryThreshold ?? windowState?.memoryThreshold;
  const showHeaderTokens = memoryTokens != null && memoryThreshold != null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border1 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-neutral6">
          <MemoryIcon className="h-4 w-4 shrink-0" />
          <Txt as="span" variant="ui-sm" className="font-medium">
            Observational memory
          </Txt>
        </span>
        {showHeaderTokens ? (
          <Txt as="span" variant="ui-xs" className="shrink-0 font-mono tabular-nums text-icon3">
            {formatCompactTokens(memoryTokens)}/{formatCompactTokens(memoryThreshold)}k
          </Txt>
        ) : null}
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="icon-sm" tooltip="Close memory panel" onClick={() => onClose?.()}>
          <XIcon />
        </Button>
      </div>

      {isLoading ? (
        <div data-testid="memory-studio-loading" className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] overflow-hidden">
          <div className="min-h-0 flex flex-col overflow-hidden">
            <ObservationDetailView
              records={omRecords}
              selectedRecordId={selectedOMRecordId}
              onSelectRecord={setManualOMRecordId}
              isLoading={isLoading}
            />
          </div>
          <div className="border-t border-border1">
            <ThreadContextProgress
              messageTokens={contextWindow?.messageTokens ?? windowState?.messageTokens}
              messageThreshold={contextWindow?.messageThreshold ?? windowState?.messageThreshold}
            />
            <FlameGraph
              omRecords={omRecords}
              markers={markers}
              messages={messages}
              tDomain={tDomain}
              onSelectTimestamp={onSelectTimestamp}
            />
          </div>
        </div>
      )}
    </div>
  );
}
