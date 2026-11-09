import { SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { ToolSectionHeader } from '../tool-section-header';
import { ToolUsedByRows } from './tool-used-by-rows';

export interface ToolUsedBySectionProps {
  toolId: string;
  currentAgentId?: string;
}

export function ToolUsedBySection(props: ToolUsedBySectionProps) {
  return (
    <SettingsGroup>
      <ToolSectionHeader>
        <SettingsTitle>Used by</SettingsTitle>
      </ToolSectionHeader>
      <ToolUsedByRows {...props} />
    </SettingsGroup>
  );
}
