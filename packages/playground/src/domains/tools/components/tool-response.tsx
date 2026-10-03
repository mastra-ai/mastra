import { SettingsContainer, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ToolRun } from '../utils/tool-run';
import { ToolResponseBody } from './tool-response-body';
import { ToolRunStatus } from './tool-run-status';

export interface ToolResponseProps {
  isRunning: boolean;
  lastRun?: ToolRun;
}

export function ToolResponse({ isRunning, lastRun }: ToolResponseProps) {
  return (
    <SettingsGroup>
      <SettingsHeader action={!isRunning && lastRun && <ToolRunStatus run={lastRun} />}>
        <SettingsTitle>Response</SettingsTitle>
      </SettingsHeader>
      <SettingsContainer>
        <ToolResponseBody isRunning={isRunning} lastRun={lastRun} />
      </SettingsContainer>
    </SettingsGroup>
  );
}
