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
      <EmptyState
        variant="fill"
        iconSlot={<Spinner />}
        titleSlot="Running…"
        descriptionSlot="Waiting for the tool to respond."
      />
    );
  }

  if (!lastRun) {
    return (
      <EmptyState
        variant="fill"
        iconSlot={<SendIcon />}
        titleSlot="No response yet"
        descriptionSlot="Fill in the request and run the tool to see its output here."
      />
    );
  }

  // Rendered straight in the card body: a CodeBlock would draw a second card inside this one.
  return <Code code={getRunCode(lastRun)} lang="json" className="overflow-x-auto text-caption whitespace-pre" />;
}
