import { AgentLayout } from './agent-layout';
import { AgentViewHeader } from './agent-view-header';

export interface AgentChatShellProps {
  agentId: string;
  view: 'chat' | 'settings';
  /** Rendered inside the main slot (header + chat/settings) */
  children: React.ReactNode;
  leftSlot: React.ReactNode;
  leftDrawerLabel: string;
  browserOverlay: React.ReactNode;
  /** Forwarded to the header's action group. */
  headerActionSlot?: React.ReactNode;
}

export function AgentChatShell({
  agentId,
  view,
  leftSlot,
  leftDrawerLabel,
  browserOverlay,
  headerActionSlot,
  children,
}: AgentChatShellProps) {
  return (
    <AgentLayout
      agentId={agentId}
      leftDrawerLabel={leftDrawerLabel}
      leftSlot={leftSlot}
      browserOverlay={browserOverlay}
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
        <AgentViewHeader agentId={agentId} view={view} actionSlot={headerActionSlot} />
        {children}
      </div>
    </AgentLayout>
  );
}
