import { MemoryDetailView as SharedMemoryDetailView } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/memory-detail-view';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

export interface MemoryDetailViewProps {
  agentId: string;
  threadId: string;
}

/** Feeds Studio's Analyze timeline and live stream progress into the shared detail panel. */
export function MemoryDetailView({ agentId, threadId }: MemoryDetailViewProps) {
  const { isPanelOpen, closePanel, selectedTimestamp, setSelectedTimestamp } = useMemoryTimeline();
  const { isObservingFromStream, isReflectingFromStream, observationsUpdatedAt, streamProgress } =
    useObservationalMemoryContext();

  return (
    <SharedMemoryDetailView
      agentId={agentId}
      threadId={threadId}
      isOpen={isPanelOpen}
      onClose={closePanel}
      selectedTimestamp={selectedTimestamp}
      onSelectTimestamp={setSelectedTimestamp}
      stream={{
        isObserving: isObservingFromStream,
        isReflecting: isReflectingFromStream,
        observationsUpdatedAt,
        progress: streamProgress,
      }}
    />
  );
}
