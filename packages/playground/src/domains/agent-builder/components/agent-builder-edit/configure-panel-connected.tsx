import { AgentConfigurePanel } from './agent-configure-panel';
import type { ActiveDetail, AgentConfig } from './agent-configure-panel';
import { useStreamRunning } from './stream-chat-context';
import type { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';

interface BaseProps {
  availableAgentTools: ReturnType<typeof useAvailableAgentTools>;
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
}

type ConfigurePanelConnectedProps =
  | (BaseProps & { editable: true })
  | (BaseProps & { editable: false; agent: AgentConfig });

export const ConfigurePanelConnected = (props: ConfigurePanelConnectedProps) => {
  const isRunning = useStreamRunning();

  if (props.editable) {
    return (
      <AgentConfigurePanel
        editable
        availableAgentTools={props.availableAgentTools}
        isLoading={false}
        activeDetail={props.activeDetail}
        onActiveDetailChange={props.onActiveDetailChange}
        disabled={isRunning}
      />
    );
  }

  return (
    <AgentConfigurePanel
      agent={props.agent}
      editable={false}
      isLoading={false}
      availableAgentTools={props.availableAgentTools}
      activeDetail={props.activeDetail}
      onActiveDetailChange={props.onActiveDetailChange}
      disabled={isRunning}
    />
  );
};
