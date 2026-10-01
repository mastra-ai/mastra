import { useToolDrawerParam } from '../../hooks/use-tool-drawer-param';
import { AgentToolDrawerBody } from './agent-tool-drawer-body';
import { ToolDrawer } from './tool-drawer';

export interface AgentToolDrawerProps {
  agentId: string;
}

/** The drawer on every agent page (chat, traces, editor), opened by `?tool=` from the Config sidebar. */
export function AgentToolDrawer({ agentId }: AgentToolDrawerProps) {
  const { toolId, close } = useToolDrawerParam();

  return (
    <ToolDrawer open={toolId !== undefined} onClose={close} toolId={toolId ?? ''}>
      {toolId && <AgentToolDrawerBody key={toolId} agentId={agentId} toolId={toolId} />}
    </ToolDrawer>
  );
}
