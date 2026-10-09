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
    <SettingsGroup className="h-full">
      <ToolSectionHeader action={!isRunning && lastRun && <ToolRunStatus run={lastRun} />}>
        <SettingsTitle>Response</SettingsTitle>
      </ToolSectionHeader>
      <SettingsContainer className="grid min-h-48 flex-1 content-center">
        <ToolResponseBody isRunning={isRunning} lastRun={lastRun} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
