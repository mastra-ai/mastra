import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { ReactFlowProvider } from '@xyflow/react';
import { Repeat2 } from 'lucide-react';
import { WorkflowNestedGraph } from './workflow-nested-graph';
import { Txt } from '@/ds/components/Txt';

export function WorkflowBodyGraph({
  stepGraph,
  workflowName,
  isForEach,
  requestContext,
}: {
  stepGraph: SerializedStepFlowEntry[];
  workflowName: string;
  isForEach?: boolean;
  requestContext: Record<string, any>;
}) {
  return (
    <section aria-label={isForEach ? 'Loop body' : 'Nested workflow'} className="flex h-full min-h-0 flex-col">
      {isForEach && (
        <div className="flex shrink-0 items-start gap-2 px-4 py-3 text-muted-foreground">
          <Repeat2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <Txt variant="meta">Runs for every item. All items finish before the workflow continues.</Txt>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ReactFlowProvider>
          <WorkflowNestedGraph
            stepGraph={stepGraph}
            embedded
            workflowName={workflowName}
            isForEach={isForEach}
            requestContext={requestContext}
          />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
