import { safeStringify } from '@mastra/core/utils/safe-stringify';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

export function WorkflowGraphBoundary({
  stepGraph,
  children,
}: {
  stepGraph: SerializedStepFlowEntry[];
  children: ReactNode;
}) {
  if (stepGraph.length === 0) {
    return (
      <p role="status" className="p-4 text-caption text-muted-foreground">
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
            <div className={cn(raisedSurfaceStyle, 'space-y-3 rounded-lg p-4')}>
              <h3 className="text-subheading text-foreground">Graph unavailable</h3>
              <p className="text-caption text-muted-foreground">Studio could not display this workflow graph.</p>
              <p className="text-meta break-words text-muted-foreground">{error.message}</p>
              <Button onClick={reset}>Try again</Button>
              <details>
                <summary className="cursor-pointer text-caption">View workflow definition</summary>
                <CopyButton content={definition} tooltip="Copy workflow definition" />
                <pre className="mt-2 max-h-64 overflow-auto text-meta break-words whitespace-pre-wrap">
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
