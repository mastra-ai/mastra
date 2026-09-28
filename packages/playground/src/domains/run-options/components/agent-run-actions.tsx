import { RequestContextPopover } from './request-context-popover';
import { RunOptionsPopover } from './run-options-popover';

interface AgentRunActionsProps {
  agentId: string;
}

/** Composer controls for an agent chat. Requires a `TracingSettingsProvider` for the agent. */
export function AgentRunActions({ agentId }: AgentRunActionsProps) {
  return (
    <>
      <RequestContextPopover entityType="agent" entityId={agentId} />
      <RunOptionsPopover />
    </>
  );
}
