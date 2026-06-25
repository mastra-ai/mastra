import { AgentLayout } from './agent-layout';
import { AgentViewHeader } from './agent-view-header';

export interface AgentChatShellProps {
  agentId: string;
  view: 'chat' | 'settings';
  /** Rendered inside the main slot (header + chat/settings) */
  children: React.ReactNode;
  leftSlot: React.ReactNode;
  leftDrawerLabel: string;
  rightSlot?: React.ReactNode;
  rightDrawerLabel?: string;
  onRightDrawerOpenChange?: (open: boolean) => void;
  browserOverlay: React.ReactNode;
}

export function AgentChatShell({
  agentId,
  view,
  leftSlot,
  leftDrawerLabel,
  rightSlot,
  rightDrawerLabel,
  onRightDrawerOpenChange,
  browserOverlay,
  children,
}: AgentChatShellProps) {
  return (
    <AgentLayout
      agentId={agentId}
      leftDrawerLabel={leftDrawerLabel}
      leftSlot={leftSlot}
      onRightDrawerOpenChange={onRightDrawerOpenChange}
      rightDrawerLabel={rightDrawerLabel}
      rightSlot={rightSlot}
      browserOverlay={browserOverlay}
    >
      <div className="grid grid-rows-[auto_1fr] h-full min-h-0">
        <AgentViewHeader agentId={agentId} view={view} />
        {children}
      </div>
    </AgentLayout>
  );
}
