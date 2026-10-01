import { SettingsContainer, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { ToolUsedByRows } from './tool-used-by-rows';

export interface ToolUsedBySectionProps {
  toolId: string;
  currentAgentId?: string;
}

export function ToolUsedBySection(props: ToolUsedBySectionProps) {
  return (
    <SettingsGroup>
      <SettingsHeader>
        <SettingsTitle>Used by</SettingsTitle>
      </SettingsHeader>
      <SettingsContainer>
        <ToolUsedByRows {...props} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
