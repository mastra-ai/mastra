import { Code } from '@mastra/playground-ui/components/Code';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { SendIcon } from 'lucide-react';
import type { ToolRun } from '../utils/tool-run';
import { getRunCode } from '../utils/tool-run';

export interface ToolResponseBodyProps {
  isRunning: boolean;
  lastRun?: ToolRun;
}

export function ToolResponseBody({ isRunning, lastRun }: ToolResponseBodyProps) {
  if (isRunning) {
    return (
      <EmptyState iconSlot={<Spinner />} titleSlot="Running…" descriptionSlot="Waiting for the tool to respond." />
    );
  }

  if (!lastRun) {
    return (
      <EmptyState
        iconSlot={<SendIcon />}
        titleSlot="No response yet"
        descriptionSlot="Run the tool to see its output here."
      />
    );
  }

  return <Code code={getRunCode(lastRun)} lang="json" className="overflow-x-auto p-4 text-caption whitespace-pre" />;
}
