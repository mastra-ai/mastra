import { SettingsContainer, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ToolRun } from '../utils/tool-run';
import { ToolResponseBody } from './tool-response-body';
import { ToolRunStatus } from './tool-run-status';
import { ToolSectionHeader } from './tool-section-header';

export interface ToolResponseProps {
  isRunning: boolean;
  lastRun?: ToolRun;
}

export function ToolResponse({ isRunning, lastRun }: ToolResponseProps) {
  return (
    <SettingsGroup>
      <ToolSectionHeader action={!isRunning && lastRun && <ToolRunStatus run={lastRun} />}>
        <SettingsTitle>Response</SettingsTitle>
      </ToolSectionHeader>
      <SettingsContainer>
        <ToolResponseBody isRunning={isRunning} lastRun={lastRun} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
