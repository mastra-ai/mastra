import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import type { ToolRun } from '../utils/tool-run';
import { ToolResponseBody } from './tool-response-body';
import { ToolRunStatus } from './tool-run-status';

export interface ToolResponseProps {
  isRunning: boolean;
  lastRun?: ToolRun;
}

export function ToolResponse({ isRunning, lastRun }: ToolResponseProps) {
  return (
    <SectionCard
      title="Response"
      description="The value the tool returned."
      action={lastRun && !isRunning ? <ToolRunStatus run={lastRun} /> : undefined}
      fillHeight
      // A grid body lets the empty state fill the card's height and center in it.
      contentClassName="grid"
    >
      <ToolResponseBody isRunning={isRunning} lastRun={lastRun} />
    </SectionCard>
  );
}
