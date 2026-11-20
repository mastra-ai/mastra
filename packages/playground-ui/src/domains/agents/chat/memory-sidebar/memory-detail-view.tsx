import {
  useMemoryThreadMessages,
  useObservationalMemory,
  useMemoryConfig,
  useThread,
} from '@mastra/react/hooks/memory';
import { useEffect } from 'react';
import { getObservationWindowTokens } from './lib/observation-window';
import type { OmAgentConfig, OmProgressData } from './lib/observation-window';

import { MemoryStudioPanel } from '@/domains/memory/components/memory-studio-panel';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

export interface MemoryDetailViewProps {
  agentId: string;
  threadId: string;
  /** Resource that owns the thread when the host knows it; otherwise read from the thread. */
  resourceId?: string;
  isOpen: boolean;
  onClose: () => void;
  selectedTimestamp: number | null;
  onSelectTimestamp: (timestamp: number | null) => void;
  /** Live progress from a host that streams Observational Memory signals. */
  stream?: {
    isObserving: boolean;
    isReflecting: boolean;
    observationsUpdatedAt: number;
    progress: OmProgressData | null;
  };
}

// How often to poll the panel's queries while observational memory is actively
// observing/reflecting, mirroring the left sidebar OM hook's active poll cadence.
const ACTIVE_POLL_INTERVAL_MS = 2000;

// Observational-memory detail subpanel that fills the Memory sidepanel, replacing
// the regular memory content while open. Owns its data fetching (gated on the
// timeline panel being open) so OM + messages requests do not fire until opened.
export function MemoryDetailView({
  agentId,
  threadId,
  resourceId,
  isOpen: isPanelOpen,
  onClose: closePanel,
  selectedTimestamp,
  onSelectTimestamp: setSelectedTimestamp,
  stream,
}: MemoryDetailViewProps) {
  // Same freshness signals the left OM sidebar uses: it polls while OM is active
  // and reacts to `observationsUpdatedAt` when new observations land. Mirror that
  // here so the timeline panel refreshes after streaming instead of going stale.
  const observationsUpdatedAt = stream?.observationsUpdatedAt ?? 0;
  const streamProgress = stream?.progress ?? null;
  const isOMActive = Boolean(stream?.isObserving || stream?.isReflecting);

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: thread } = useThread({
    threadId: threadId,
    agentId: agentId,
    requestContext,
    queryOptions: { enabled: !resourceId && Boolean(threadId) && threadId !== 'new' && Boolean(agentId) },
  });
  const effectiveResourceId = resourceId ?? thread?.resourceId ?? agentId;

  // Config thresholds, read the same way the OM sidebar section does.
  const { data: configData } = useMemoryConfig({
    agentId: agentId,
    requestContext,
    queryOptions: { enabled: Boolean(agentId) },
  });

  const {
    data: omData,
    isLoading: isOMLoading,
    refetch: refetchOM,
  } = useObservationalMemory({
    agentId: isPanelOpen ? agentId : undefined,
    threadId: isPanelOpen ? threadId : undefined,
    resourceId: effectiveResourceId,
  });
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useMemoryThreadMessages({ threadId: isPanelOpen ? threadId : undefined, agentId });

  // Refetch as soon as new observations are signalled (e.g. on stream finish),
  // matching the left sidebar's `observationsUpdatedAt`-driven refresh.
  useEffect(() => {
    if (!isPanelOpen || observationsUpdatedAt === 0) return;
    void refetchOM();
    void refetchMessages();
  }, [isPanelOpen, observationsUpdatedAt, refetchOM, refetchMessages]);

  // Poll while OM is actively observing/reflecting, mirroring the left sidebar's
  // active poll cadence so in-progress observations show up live.
  useEffect(() => {
    if (!isPanelOpen || !isOMActive) return;
    const id = setInterval(() => {
      void refetchOM();
      void refetchMessages();
    }, ACTIVE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPanelOpen, isOMActive, refetchOM, refetchMessages]);

  if (!isPanelOpen) return null;

  // Derive the authoritative MESSAGES/OBSERVATIONS counters the same way the OM
  // sidebar section does (live stream progress > record > config), and feed them
  // to the panel so both UIs always agree. The panel falls back to its
  // marker-derived values when this is absent.
  const omAgentConfig = (configData?.config as { observationalMemory?: OmAgentConfig } | undefined)
    ?.observationalMemory;
  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;
  const windowTokens = getObservationWindowTokens({
    record: omData?.record,
    liveProgress,
    agentConfig: omAgentConfig,
  });

  return (
    <div data-testid="memory-sidebar-om-detail-subpanel" className="h-full min-h-0 min-w-0 overflow-hidden bg-card">
      <MemoryStudioPanel
        messages={messagesData?.messages ?? []}
        omRecords={omData?.history ?? []}
        isLoading={isOMLoading || isMessagesLoading}
        onClose={closePanel}
        selectedTimestamp={selectedTimestamp}
        onSelectTimestamp={setSelectedTimestamp}
        contextWindow={{
          messageTokens: windowTokens.messageTokens,
          messageThreshold: windowTokens.messageThreshold,
          memoryTokens: windowTokens.observationTokens,
          memoryThreshold: windowTokens.observationThreshold,
        }}
      />
    </div>
  );
}
