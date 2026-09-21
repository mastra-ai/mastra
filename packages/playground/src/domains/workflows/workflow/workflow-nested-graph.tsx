import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { WorkflowGraphCanvas, WORKFLOW_BOUNDARY_NODE_TYPE } from '@mastra/playground-ui/components/Workflow';

import { useMemo, useState } from 'react';
import { useCurrentRun } from '../context/use-current-run';
import { useWorkflowGraphNodes } from './use-workflow-graph-nodes';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { WorkflowGraphBoundary } from './workflow-graph-boundary';
import { getWorkflowGraphGroups } from './workflow-graph-groups';
import { getWorkflowIterationScopes } from './workflow-iteration-scopes';

export interface WorkflowNestedGraphProps {
  stepGraph: SerializedStepFlowEntry[];
  workflowName: string;
  isForEach?: boolean;
  embedded?: boolean;
}

export function WorkflowNestedGraph(props: WorkflowNestedGraphProps) {
  const layoutKey = useMemo(
    () => `${props.workflowName}:${JSON.stringify(props.stepGraph)}`,
    [props.workflowName, props.stepGraph],
  );
  return (
    <WorkflowGraphBoundary key={layoutKey} stepGraph={props.stepGraph}>
      <WorkflowNestedGraphContent {...props} />
    </WorkflowGraphBoundary>
  );
}

function WorkflowNestedGraphContent({ stepGraph, workflowName, isForEach, embedded }: WorkflowNestedGraphProps) {
  const { nodes, edges, onNodesChange } = useWorkflowGraphNodes(stepGraph);
  const { steps } = useCurrentRun();
  const iterations = getWorkflowIterationScopes(Object.keys(steps), workflowName);
  const [selectedIteration, setSelectedIteration] = useState<string>();
  const activeIteration = iterations.find(iteration => iteration.value === selectedIteration) ?? iterations[0];

  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({
    edges,
    workflowName: activeIteration?.value ?? workflowName,
  });

  const labeledNodes = useMemo(
    () =>
      nodes.map(node => {
        if (!isForEach || node.type !== WORKFLOW_BOUNDARY_NODE_TYPE) return node;
        const label = node.data.boundaryRole === 'start' ? 'Each item' : 'Item result';
        return { ...node, data: { ...node.data, label } };
      }),
    [nodes, isForEach],
  );
  const groups = useMemo(() => getWorkflowGraphGroups(nodes), [nodes]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {activeIteration && (
        <div className="nodrag nopan border-border1 flex items-center gap-3 border-b px-4 py-2">
          <span className="text-caption text-muted-foreground">Iteration</span>
          <Select value={activeIteration.value} onValueChange={setSelectedIteration} items={iterations}>
            <SelectTrigger aria-label="Loop item" size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {iterations.map(iteration => (
                <SelectItem key={iteration.value} value={iteration.value}>
                  {iteration.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <WorkflowGraphCanvas
          variant={embedded ? 'inline' : 'nested'}
          groups={groups}
          nodes={labeledNodes}
          edges={styledEdges}
          edgeTypes={edgeTypes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
        />
      </div>
    </div>
  );
}
