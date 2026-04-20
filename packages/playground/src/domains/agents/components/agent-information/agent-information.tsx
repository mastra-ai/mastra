import { useBrowserSession } from '../../context/browser-session-context';
import { usePanelVisibility } from '../../context/use-panel-visibility';
import { BrowserSidebarTab } from '../browser-view/browser-sidebar-tab';
import { MemoryCardSection } from './memory-card-section';
import { OverviewCardSection } from './overview-card-section';
import { useMemory } from '@/domains/memory/hooks';

export interface AgentInformationProps {
  agentId: string;
  threadId: string;
}

export function AgentInformation({ agentId, threadId }: AgentInformationProps) {
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { hasSession, isInSidebar } = useBrowserSession();
  const { visibility } = usePanelVisibility();

  const hasMemory = !isMemoryLoading && Boolean(memory?.result);

  const showOverview = visibility.overview;
  const showMemory = visibility.memory && hasMemory;

  return (
    <div className="h-full relative flex flex-col pb-4 pr-4 gap-4 min-h-0">
      {hasSession && isInSidebar && (
        <div className="absolute inset-0 z-10 bg-surface1">
          <BrowserSidebarTab />
        </div>
      )}

      <div className="flex flex-row gap-4 flex-1 min-h-0">
        {showOverview && (
          <div className="flex-1 min-w-0 h-full">
            <OverviewCardSection agentId={agentId} />
          </div>
        )}

        {showMemory && (
          <div className="flex-1 min-w-0 h-full">
            <MemoryCardSection agentId={agentId} threadId={threadId} memoryType={memory?.memoryType} />
          </div>
        )}
      </div>
    </div>
  );
}
