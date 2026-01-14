import { useCallback } from 'react';
import type { BuilderNode, TriggerNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { VisualSchemaEditor } from './visual-schema-editor';

export interface TriggerConfigProps {
  node: BuilderNode;
}

export function TriggerConfig({ node }: TriggerConfigProps) {
  const data = node.data as TriggerNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);

  // Get workflow-level schemas from store
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const outputSchema = useWorkflowBuilderStore(state => state.outputSchema);
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);

  // Store actions for updating schemas
  const setInputSchema = useCallback((schema: Record<string, unknown>) => {
    useWorkflowBuilderStore.setState({ inputSchema: schema, isDirty: true });
  }, []);

  const setOutputSchema = useCallback((schema: Record<string, unknown>) => {
    useWorkflowBuilderStore.setState({ outputSchema: schema, isDirty: true });
  }, []);

  const setStateSchema = useCallback((schema: Record<string, unknown>) => {
    useWorkflowBuilderStore.setState({ stateSchema: schema, isDirty: true });
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Trigger"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Description</Label>
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
        />
      </div>

      <div className="border-t border-border1 pt-4">
        <VisualSchemaEditor
          label="Input Schema"
          description="Define the data this workflow accepts when triggered"
          schema={inputSchema}
          onChange={setInputSchema}
          defaultExpanded={true}
        />
      </div>

      <div className="border-t border-border1 pt-4">
        <VisualSchemaEditor
          label="Output Schema"
          description="Define the data this workflow returns when completed"
          schema={outputSchema}
          onChange={setOutputSchema}
        />
      </div>

      <div className="border-t border-border1 pt-4">
        <VisualSchemaEditor
          label="State Schema"
          description="Define persistent state for suspend/resume workflows"
          schema={stateSchema}
          onChange={setStateSchema}
        />
      </div>

      <div className="p-3 bg-surface3 rounded-lg space-y-2">
        <p className="text-xs text-icon4">
          This is the entry point of your workflow. Configure schemas to define the workflow's interface.
        </p>
        <div className="text-[10px] text-icon3 space-y-1">
          <p>
            <strong>Input:</strong> Data the workflow receives when triggered
          </p>
          <p>
            <strong>Output:</strong> Data the workflow returns when completed
          </p>
          <p>
            <strong>State:</strong> Persistent data for workflows that suspend and resume
          </p>
        </div>
      </div>
    </div>
  );
}
