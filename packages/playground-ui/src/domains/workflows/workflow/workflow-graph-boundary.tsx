import { safeStringify } from '@mastra/core/utils/safe-stringify';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';
import { Txt } from '@/ds/components/Txt';
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
      <Txt variant="caption" tone="muted" role="status" className="p-4">
        This workflow has no steps to display.
      </Txt>
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
              <Txt as="h3" variant="subheading" tone="ink">
                Graph unavailable
              </Txt>
              <Txt variant="caption" tone="muted">
                Studio could not display this workflow graph.
              </Txt>
              <Txt variant="meta" tone="muted" className="break-words">
                {error.message}
              </Txt>
              <Button onClick={reset}>Try again</Button>
              <details>
                <Txt as="summary" variant="caption" className="cursor-pointer">
                  View workflow definition
                </Txt>
                <CopyButton content={definition} tooltip="Copy workflow definition" />
                <Txt as="pre" variant="meta" className="mt-2 max-h-64 overflow-auto break-words whitespace-pre-wrap">
                  {definition}
                </Txt>
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
