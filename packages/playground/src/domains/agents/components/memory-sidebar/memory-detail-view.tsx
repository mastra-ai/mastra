import { MemoryStudioPanel } from '@mastra/playground-ui/domains/memory/components/memory-studio-panel';
import { useMemoryThreadMessages } from '@mastra/playground-ui/domains/memory/hooks/use-memory-thread-messages';
import { useObservationalMemory } from '@mastra/playground-ui/domains/memory/hooks/use-observational-memory';
import { useEffect } from 'react';

import { getObservationWindowTokens } from './lib/observation-window';
import type { OmAgentConfig } from './lib/observation-window';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';
import { useMemoryConfig, useThread } from '@/domains/memory/hooks';

export interface MemoryDetailViewProps {
  agentId: string;
  threadId: string;
}

// How often to poll the panel's queries while observational memory is actively
// observing/reflecting, mirroring the left sidebar OM hook's active poll cadence.
const ACTIVE_POLL_INTERVAL_MS = 2000;

// Observational-memory detail subpanel that fills the Memory sidepanel, replacing
// the regular memory content while open. Owns its data fetching (gated on the
// timeline panel being open) so OM + messages requests do not fire until opened.
export function MemoryDetailView({ agentId, threadId }: MemoryDetailViewProps) {
  const { isPanelOpen, closePanel, selectedTimestamp, setSelectedTimestamp } = useMemoryTimeline();

  // Same freshness signals the left OM sidebar uses: it polls while OM is active
  // and reacts to `observationsUpdatedAt` when new observations land. Mirror that
  // here so the timeline panel refreshes after streaming instead of going stale.
  const { isObservingFromStream, isReflectingFromStream, observationsUpdatedAt, streamProgress } =
    useObservationalMemoryContext();
  const isOMActive = isObservingFromStream || isReflectingFromStream;

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const { data: thread } = useThread({ threadId, agentId });
  const effectiveResourceId = thread?.resourceId ?? agentId;

  // Config thresholds, read the same way the OM sidebar section does.
  const { data: configData } = useMemoryConfig(agentId);

  const {
    data: omData,
    isLoading: isOMLoading,
    refetch: refetchOM,
  } = useObservationalMemory(
    isPanelOpen ? agentId : undefined,
    isPanelOpen ? threadId : undefined,
    effectiveResourceId,
  );
  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useMemoryThreadMessages(isPanelOpen ? threadId : undefined);

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
    <div data-testid="memory-sidebar-om-detail-subpanel" className="h-full min-h-0 min-w-0 overflow-hidden bg-surface3">
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
