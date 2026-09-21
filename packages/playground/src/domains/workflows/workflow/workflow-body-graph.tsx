import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ReactFlowProvider } from '@xyflow/react';
import { Repeat2 } from 'lucide-react';
import { WorkflowNestedGraph } from './workflow-nested-graph';

export function WorkflowBodyGraph({
  stepGraph,
  workflowName,
  isForEach,
}: {
  stepGraph: SerializedStepFlowEntry[];
  workflowName: string;
  isForEach?: boolean;
}) {
  return (
    <section aria-label={isForEach ? 'Loop body' : 'Nested workflow'} className="flex h-full min-h-0 flex-col">
      {isForEach && (
        <div className="text-muted-foreground flex shrink-0 items-start gap-2 px-4 py-3">
          <Repeat2 aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <Txt variant="ui-xs">Runs for every item. All items finish before the workflow continues.</Txt>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ReactFlowProvider>
          <WorkflowNestedGraph stepGraph={stepGraph} embedded workflowName={workflowName} isForEach={isForEach} />
        </ReactFlowProvider>
      </div>
    </section>
  );
}
