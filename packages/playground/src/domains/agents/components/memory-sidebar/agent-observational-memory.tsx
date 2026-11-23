import { AgentObservationalMemory as SharedAgentObservationalMemory } from '@mastra/playground-ui/domains/agents/chat/memory-sidebar/agent-observational-memory';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

/** Feeds Studio's live stream progress and Analyze timeline into the shared Observational Memory panel. */
export const AgentObservationalMemory = (props: AgentObservationalMemoryProps) => {
  const { isPanelOpen, openPanel, closePanel } = useMemoryTimeline();
  const { isObservingFromStream, isReflectingFromStream, streamProgress, clearProgress } =
    useObservationalMemoryContext();

  return (
    <SharedAgentObservationalMemory
      {...props}
      stream={{
        isObserving: isObservingFromStream,
        isReflecting: isReflectingFromStream,
        progress: streamProgress,
        clearProgress,
      }}
      detailView={{ isOpen: isPanelOpen, open: openPanel, close: closePanel }}
    />
  );
};
