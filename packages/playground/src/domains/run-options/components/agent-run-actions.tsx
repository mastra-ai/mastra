import { RequestContextPopover } from './request-context-popover';
import { RunOptionsPopover } from './run-options-popover';

interface AgentRunActionsProps {
  agentId: string;
  requestContextSchema?: string;
}

/** Composer controls for an agent chat. Requires a `TracingSettingsProvider` for the agent. */
export function AgentRunActions({ agentId, requestContextSchema }: AgentRunActionsProps) {
  return (
    <>
      <RequestContextPopover entityType="agent" entityId={agentId} requestContextSchema={requestContextSchema} />
      <RunOptionsPopover />
    </>
  );
}
