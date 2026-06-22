import { XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { extractOmMarkers } from '../lib/extract-markers';
import { findRecordIdAtOrBefore } from '../lib/replay-selection';
import { getLatestThreadContextWindowState } from '../lib/thread-context-window-state';
import { timestampsToTDomain } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';
import { FlameGraph } from './flame-graph';
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
}

export function MemoryStudioPanel({
  messages,
  omRecords,
  isLoading = false,
  onClose,
  selectedTimestamp,
  onSelectTimestamp,
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border1 px-4 py-2.5">
        <h2 className="text-sm font-medium text-neutral6">Memory</h2>
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
              messageTokens={windowState?.messageTokens}
              messageThreshold={windowState?.messageThreshold}
              memoryTokens={windowState?.memoryTokens}
              memoryThreshold={windowState?.memoryThreshold}
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
