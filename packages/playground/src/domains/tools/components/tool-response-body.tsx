import { Code } from '@mastra/playground-ui/components/Code';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
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

  if (lastRun.status === 'error') {
    return <Code code={getRunCode(lastRun)} className="overflow-x-auto p-4 text-caption whitespace-pre" />;
  }

  return (
    <CodeEditor
      value={getRunCode(lastRun)}
      language="json"
      editable={false}
      lineNumbers={false}
      showCopyButton={false}
      variant="embedded"
      aria-label="Tool response"
      className="p-4"
    />
  );
}
