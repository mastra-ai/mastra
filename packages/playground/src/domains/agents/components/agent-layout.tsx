import { useThreadsPanel } from '@mastra/playground-ui/domains/agents/chat';
import { AgentConversationLayout } from '@mastra/playground-ui/domains/agents/components/agent-conversation-layout';
import { useEffect, useRef } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useMemoryTimeline } from '../context/memory-timeline-context';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  leftDrawerLabel?: string;
  rightDrawerLabel?: string;
  browserOverlay?: React.ReactNode;
}

const MEMORY_DETAIL_LEFT_PANEL_DEFAULT_RESTORE = '300px';

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  leftDrawerLabel,
  rightDrawerLabel,
  browserOverlay,
}: AgentLayoutProps) => {
  const { isPanelOpen: isMemoryTimelineOpen } = useMemoryTimeline();
  const threadsPanel = useThreadsPanel();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const wasMemoryTimelineOpen = useRef(false);
  const sizeBeforeMemoryDetail = useRef<string | null>(null);

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    if (!leftPanel) return;

    const wasOpen = wasMemoryTimelineOpen.current;
    wasMemoryTimelineOpen.current = isMemoryTimelineOpen;

    if (isMemoryTimelineOpen && !wasOpen) {
      sizeBeforeMemoryDetail.current = `${leftPanel.getSize().inPixels}px`;
      leftPanel.resize('50%');
    } else if (!isMemoryTimelineOpen && wasOpen) {
      leftPanel.resize(sizeBeforeMemoryDetail.current ?? MEMORY_DETAIL_LEFT_PANEL_DEFAULT_RESTORE);
      sizeBeforeMemoryDetail.current = null;
    }
  }, [isMemoryTimelineOpen]);

  return (
    <AgentConversationLayout
      layoutId={`agent-layout-v6-${agentId}`}
      leftSlot={leftSlot}
      rightSlot={rightSlot}
      leftDrawerLabel={leftDrawerLabel}
      rightDrawerLabel={rightDrawerLabel}
      browserOverlay={browserOverlay}
      leftPanelRef={leftPanelRef}
      onLeftPanelRegister={threadsPanel?.registerPanel}
    >
      {children}
    </AgentConversationLayout>
  );
};
