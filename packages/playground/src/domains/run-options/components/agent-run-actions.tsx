import { RequestContextPopover } from './request-context-popover';
import { RunOptionsPopover } from './run-options-popover';

interface AgentRunActionsProps {
  agentId: string;
}

export function AgentRunActions({ agentId }: AgentRunActionsProps) {
  return (
    <>
      <RequestContextPopover entityType="agent" entityId={agentId} />
      <RunOptionsPopover entityType="agent" entityId={agentId} />
    </>
  );
}
