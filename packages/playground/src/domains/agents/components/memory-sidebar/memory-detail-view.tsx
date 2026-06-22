import { MemoryStudioPanel, useMemoryThreadMessages, useObservationalMemory } from '@mastra/playground-ui';

import { useMemoryTimeline } from '@/domains/agents/context/memory-timeline-context';
import { useThread } from '@/domains/memory/hooks';

export interface MemoryDetailViewProps {
  agentId: string;
  threadId: string;
}

// Observational-memory detail subpanel rendered as the right column inside the Memory sidepanel.
// Owns its data fetching (gated on the timeline panel being open) so OM + messages
// requests do not fire until the user toggles the detail view on.
export function MemoryDetailView({ agentId, threadId }: MemoryDetailViewProps) {
  const { isPanelOpen, closePanel, selectedTimestamp, setSelectedTimestamp } = useMemoryTimeline();

  // Resolve the thread's actual resourceId (may differ from agentId for externally-created threads)
  const { data: thread } = useThread({ threadId, agentId });
  const effectiveResourceId = thread?.resourceId ?? agentId;

  const { data: omData, isLoading: isOMLoading } = useObservationalMemory(
    isPanelOpen ? agentId : undefined,
    isPanelOpen ? threadId : undefined,
    effectiveResourceId,
  );
  const { data: messagesData, isLoading: isMessagesLoading } = useMemoryThreadMessages(
    isPanelOpen ? threadId : undefined,
  );

  if (!isPanelOpen) return null;

  return (
    <div
      data-testid="memory-sidebar-om-detail-subpanel"
      className="h-full min-h-0 min-w-0 overflow-hidden border-l border-border1/50 bg-surface3"
    >
      <MemoryStudioPanel
        messages={messagesData?.messages ?? []}
        omRecords={omData?.history ?? []}
        isLoading={isOMLoading || isMessagesLoading}
        onClose={closePanel}
        selectedTimestamp={selectedTimestamp}
        onSelectTimestamp={setSelectedTimestamp}
      />
    </div>
  );
}
