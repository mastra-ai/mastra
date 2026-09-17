import { AdvancedModelSettings } from '@mastra/playground-ui/components/ModelSettings';
import { useAgentSettings } from '@/domains/agents/context/agent-context';

export interface AgentAdvancedSettingsBodyProps {
  canEdit?: boolean;
}

export const AgentAdvancedSettingsBody = ({ canEdit = true }: AgentAdvancedSettingsBodyProps) => {
  const { settings, setSettings } = useAgentSettings();
  return (
    <AdvancedModelSettings
      canEdit={canEdit}
      value={settings?.modelSettings ?? {}}
      onChange={value => setSettings({ ...settings, modelSettings: { ...settings?.modelSettings, ...value } })}
    />
  );
};
