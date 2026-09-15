import { safeStringify } from '@mastra/core/utils/safe-stringify';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { ErrorBoundary } from '@mastra/playground-ui/components/ErrorBoundary';
import type { ReactNode } from 'react';

export function WorkflowGraphBoundary({
  stepGraph,
  children,
}: {
  stepGraph: SerializedStepFlowEntry[];
  children: ReactNode;
}) {
  if (stepGraph.length === 0) {
    return (
      <p role="status" className="text-ui-sm text-neutral3 p-4">
        This workflow has no steps to display.
      </p>
    );
  }
  return (
    <ErrorBoundary
      resetKeys={[stepGraph]}
      fallback={({ error, reset }) => {
        const definition = safeStringify(stepGraph, 2);
        return (
          <div role="alert" className="nodrag nopan nowheel h-full overflow-auto p-4">
            <div className="bg-surface3 border-border1 space-y-3 rounded-lg border p-4">
              <h3 className="text-ui-md text-neutral6 font-medium">Graph unavailable</h3>
              <p className="text-ui-sm text-neutral3">Studio could not display this workflow graph.</p>
              <p className="text-ui-xs text-neutral3 break-words">{error.message}</p>
              <Button onClick={reset}>Try again</Button>
              <details>
                <summary className="text-ui-sm cursor-pointer">View workflow definition</summary>
                <CopyButton content={definition} tooltip="Copy workflow definition" />
                <pre className="text-ui-xs mt-2 max-h-64 overflow-auto break-words whitespace-pre-wrap">
                  {definition}
                </pre>
              </details>
            </div>
          </div>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
