import { useMemo, useState } from 'react';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { BuilderNode, WorkflowNodeData, ValueOrRef } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorIds } from '../../hooks/use-graph-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import {
  ConfigField,
  ConfigInfoBox,
  DataReferencePicker,
  OutputReference,
  SectionHeader,
  type DataReference,
} from './shared';

export interface WorkflowConfigProps {
  node: BuilderNode;
}

type InputMappingMode = 'reference' | 'static';

interface InputMappingEntry {
  key: string;
  mode: InputMappingMode;
  value: string;
  ref?: string;
}

export function WorkflowConfig({ node }: WorkflowConfigProps) {
  const data = node.data as WorkflowNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const currentWorkflowId = useWorkflowBuilderStore(state => state.workflowId);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);
  const { data: workflows, isLoading } = useWorkflows();

  // Section expansion state
  const [inputExpanded, setInputExpanded] = useState(true);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Use shared hook for predecessor calculation
  const predecessorStepIds = usePredecessorIds(node.id);
  const predecessorSet = useMemo(() => new Set(predecessorStepIds), [predecessorStepIds]);

  // Build available variable references for input mapping
  const availableRefs = useMemo(() => {
    const refs: DataReference[] = [];

    // Add input schema fields (always available)
    if (inputSchema && typeof inputSchema === 'object') {
      const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const key of Object.keys(properties)) {
          refs.push({
            path: `input.${key}`,
            label: `input.${key}`,
            description: 'Workflow input',
            sourceType: 'input',
          });
        }
      }
    }

    // Add workflow state fields (if state schema is defined)
    if (stateSchema && typeof stateSchema === 'object') {
      const stateProperties = (stateSchema as { properties?: Record<string, unknown> }).properties;
      if (stateProperties) {
        for (const key of Object.keys(stateProperties)) {
          refs.push({
            path: `state.${key}`,
            label: `state.${key}`,
            description: 'Persists across suspend/resume',
            sourceType: 'state',
          });
        }
      }
    }

    // Add outputs from predecessor steps only
    for (const n of nodes) {
      if (n.id === node.id) continue;
      if (n.data.type === 'trigger') continue;
      if (!predecessorSet.has(n.id)) continue;

      refs.push({
        path: `steps.${n.id}.output`,
        label: `${n.data.label} output`,
        description: 'Full output object',
        sourceType: 'step',
      });

      // For agent steps, add common output fields
      if (n.data.type === 'agent') {
        refs.push({
          path: `steps.${n.id}.output.text`,
          label: `${n.data.label} text`,
          description: 'Agent response text',
          sourceType: 'step',
        });
      }
    }

    return refs;
  }, [nodes, node.id, inputSchema, stateSchema, predecessorSet]);

  // Filter out the current workflow to prevent recursion
  const availableWorkflows = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows)
      .filter(([id]) => id !== currentWorkflowId)
      .map(([id, wf]) => ({
        id,
        name: wf.name || id,
        description: wf.description,
        inputSchema: wf.inputSchema,
      }));
  }, [workflows, currentWorkflowId]);

  const selectedWorkflow = useMemo(() => {
    if (!data.workflowId || !workflows) return null;
    return workflows[data.workflowId];
  }, [data.workflowId, workflows]);

  // Get the expected input keys from the selected workflow's input schema
  const expectedInputKeys = useMemo(() => {
    if (!selectedWorkflow?.inputSchema) return [];
    const schema = selectedWorkflow.inputSchema as { properties?: Record<string, unknown> };
    if (!schema.properties) return [];
    return Object.keys(schema.properties);
  }, [selectedWorkflow]);

  // Update input mapping for a specific key
  const updateInputMapping = (key: string, value: ValueOrRef | null) => {
    const newInput = { ...data.input };
    if (value === null) {
      delete newInput[key];
    } else {
      newInput[key] = value;
    }
    updateNodeData(node.id, { input: newInput });
  };

  // Get current mapping for a key
  const getInputMapping = (key: string): { mode: InputMappingMode; value: string } => {
    const mapping = data.input[key];
    if (!mapping) return { mode: 'reference', value: '' };

    if (typeof mapping === 'object' && '$ref' in mapping) {
      return { mode: 'reference', value: mapping.$ref };
    }

    if (typeof mapping === 'object' && '$literal' in mapping) {
      return { mode: 'static', value: String(mapping.$literal ?? '') };
    }

    return { mode: 'static', value: '' };
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <ConfigField label="Label">
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Sub-Workflow"
        />
      </ConfigField>

      {/* Workflow Selection */}
      <ConfigField label="Workflow" required>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading workflows...
          </div>
        ) : availableWorkflows.length === 0 ? (
          <ConfigInfoBox variant="warning">
            No other workflows available. Create additional workflows to use sub-workflow steps.
          </ConfigInfoBox>
        ) : (
          <Select
            value={data.workflowId ?? ''}
            onValueChange={value => {
              updateNodeData(node.id, { workflowId: value || null, input: {} });
            }}
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
      </ConfigField>

      {/* Selected Workflow Info */}
      {selectedWorkflow && (
        <ConfigInfoBox>
          <p className="font-medium text-icon5">{selectedWorkflow.name}</p>
          {selectedWorkflow.description && (
            <p className="text-icon3 mt-1 line-clamp-2">{selectedWorkflow.description}</p>
          )}
        </ConfigInfoBox>
      )}

      {/* Info */}
      <ConfigInfoBox variant="info">
        Sub-workflows allow you to call another workflow as a step. The called workflow's output becomes this step's
        output.
      </ConfigInfoBox>

      {/* Divider */}
      <div className="border-t border-border1 my-4" />

      {/* Input Mapping Section */}
      <div className="space-y-3">
        <SectionHeader
          title="Input Mapping"
          icon={<ArrowDownToLine className="w-4 h-4" />}
          expanded={inputExpanded}
          onToggle={() => setInputExpanded(!inputExpanded)}
          badge={expectedInputKeys.length}
        />

        {inputExpanded && (
          <div className="space-y-4 pl-1">
            {!selectedWorkflow ? (
              <p className="text-xs text-icon3">Select a workflow to configure input mapping.</p>
            ) : expectedInputKeys.length === 0 ? (
              <p className="text-xs text-icon3">This workflow does not require any inputs.</p>
            ) : (
              <div className="space-y-3">
                {expectedInputKeys.map(key => {
                  const mapping = getInputMapping(key);

                  return (
                    <div key={key} className="p-3 bg-surface3/50 rounded-lg border border-border1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-icon6">{key}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateInputMapping(key, { $ref: '' })}
                            className={`px-2 py-1 text-[10px] rounded transition-colors ${
                              mapping.mode === 'reference'
                                ? 'bg-accent1/20 text-accent1'
                                : 'bg-surface4 text-icon4 hover:text-icon5'
                            }`}
                          >
                            Reference
                          </button>
                          <button
                            type="button"
                            onClick={() => updateInputMapping(key, { $literal: '' })}
                            className={`px-2 py-1 text-[10px] rounded transition-colors ${
                              mapping.mode === 'static'
                                ? 'bg-accent1/20 text-accent1'
                                : 'bg-surface4 text-icon4 hover:text-icon5'
                            }`}
                          >
                            Static
                          </button>
                        </div>
                      </div>

                      {mapping.mode === 'reference' ? (
                        <DataReferencePicker
                          references={availableRefs}
                          value={mapping.value || undefined}
                          onChange={path => updateInputMapping(key, path ? { $ref: path } : null)}
                          placeholder={`Select source for ${key}...`}
                        />
                      ) : (
                        <Input
                          value={mapping.value}
                          onChange={e => updateInputMapping(key, { $literal: e.target.value })}
                          placeholder={`Enter value for ${key}...`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show raw schema for debugging */}
            {selectedWorkflow?.inputSchema && (
              <details className="mt-4">
                <summary className="text-[10px] text-icon3 cursor-pointer hover:text-icon4">
                  View raw input schema
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-icon5 bg-surface4 p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedWorkflow.inputSchema, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Output Section */}
      <div className="space-y-3">
        <SectionHeader
          title="Output"
          icon={<ArrowUpFromLine className="w-4 h-4" />}
          expanded={outputExpanded}
          onToggle={() => setOutputExpanded(!outputExpanded)}
        />

        {outputExpanded && (
          <div className="pl-1">
            <OutputReference stepId={node.id} paths={[{ path: 'output', description: 'Full sub-workflow output' }]} />
            <p className="text-[10px] text-icon3 mt-3 pl-1">
              Use this reference in downstream steps to access the sub-workflow's output.
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      <ConfigField label="Description">
        <Textarea
          value={data.description ?? ''}
          onChange={e => updateNodeData(node.id, { description: e.target.value })}
          placeholder="Optional description..."
          rows={2}
        />
      </ConfigField>
    </div>
  );
}
