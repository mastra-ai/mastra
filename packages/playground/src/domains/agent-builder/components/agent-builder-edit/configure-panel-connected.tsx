import type { StoredSkillResponse } from '@mastra/client-js';
import { AgentConfigurePanel } from './agent-configure-panel';
import type { ActiveDetail, AgentConfig } from './agent-configure-panel';
import { useStreamRunning } from './stream-chat-context';
import type { useAvailableAgentTools } from '@/domains/agent-builder/hooks/use-available-agent-tools';

interface BaseProps {
  availableAgentTools: ReturnType<typeof useAvailableAgentTools>;
  availableSkills?: StoredSkillResponse[];
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
        availableSkills={props.availableSkills}
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
      availableSkills={props.availableSkills}
      activeDetail={props.activeDetail}
      onActiveDetailChange={props.onActiveDetailChange}
      disabled={isRunning}
    />
  );
};
