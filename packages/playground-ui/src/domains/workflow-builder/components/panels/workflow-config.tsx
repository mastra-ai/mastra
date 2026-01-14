import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { BuilderNode, WorkflowNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export interface WorkflowConfigProps {
  node: BuilderNode;
}

export function WorkflowConfig({ node }: WorkflowConfigProps) {
  const data = node.data as WorkflowNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const currentWorkflowId = useWorkflowBuilderStore(state => state.workflowId);
  const { data: workflows, isLoading } = useWorkflows();

  // Filter out the current workflow to prevent recursion
  const availableWorkflows = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows)
      .filter(([id]) => id !== currentWorkflowId)
      .map(([id, wf]) => ({
        id,
        name: wf.name || id,
        description: wf.description,
      }));
  }, [workflows, currentWorkflowId]);

  const selectedWorkflow = useMemo(() => {
    if (!data.workflowId || !workflows) return null;
    return workflows[data.workflowId];
  }, [data.workflowId, workflows]);

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <input
          type="text"
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Sub-Workflow"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Workflow Selection */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Workflow</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading workflows...
          </div>
        ) : (
          <Select
            value={data.workflowId ?? ''}
            onValueChange={value => updateNodeData(node.id, { workflowId: value || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a workflow" />
            </SelectTrigger>
            <SelectContent>
              {availableWorkflows.map(wf => (
                <SelectItem key={wf.id} value={wf.id}>
                  {wf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selected Workflow Info */}
      {selectedWorkflow && (
        <div className="p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon5 font-medium">{selectedWorkflow.name}</p>
          {selectedWorkflow.description && (
            <p className="text-xs text-icon3 mt-1 line-clamp-2">{selectedWorkflow.description}</p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-2 bg-surface2 rounded text-[10px] text-icon4">
        Sub-workflows allow you to call another workflow as a step. The called workflow's output becomes this step's
        output.
      </div>

      {/* Input Mapping Info */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Input Mapping</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4">
            Input mapping will be configured based on the selected workflow's input schema. Select a workflow to see
            available inputs.
          </p>
          {selectedWorkflow?.inputSchema && (
            <div className="mt-2">
              <p className="text-[10px] text-icon3 mb-1">Expected inputs:</p>
              <pre className="text-[10px] font-mono text-icon5 bg-surface3 p-2 rounded overflow-x-auto">
                {JSON.stringify(selectedWorkflow.inputSchema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Output Reference */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Output Reference</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4 mb-2">Sub-workflow output will be available at:</p>
          <code className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
            steps.{node.id}.output
          </code>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
          className="bg-surface1 text-icon6"
        />
      </div>
    </div>
  );
}
