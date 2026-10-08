import { useAgentWorkspace } from '../context/agent-workspace-context';

/** Layout-owned host for the active view's working sections. */
export function AgentNavigationSlot() {
  const workspace = useAgentWorkspace();
  return <div ref={workspace?.registerNavigationTarget} className="flex min-h-0 flex-1 flex-col" />;
}
