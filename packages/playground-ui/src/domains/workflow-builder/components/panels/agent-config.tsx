import { useMemo, useState } from 'react';
import type { BuilderNode, AgentNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorIds } from '../../hooks/use-graph-utils';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import {
  ConfigField,
  ConfigInfoBox,
  DataReferencePicker,
  OutputReference,
  SectionHeader,
  type DataReference,
} from './shared';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

export interface AgentConfigProps {
  node: BuilderNode;
}

export function AgentConfig({ node }: AgentConfigProps) {
  const data = node.data as AgentNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const { data: agents, isLoading } = useAgents();
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);
  const stateSchema = useWorkflowBuilderStore(state => state.stateSchema);

  // Section expansion state
  const [inputExpanded, setInputExpanded] = useState(true);
  const [outputExpanded, setOutputExpanded] = useState(false);

  // Use shared hook for predecessor calculation
  const predecessorStepIds = usePredecessorIds(node.id);
  const predecessorSet = useMemo(() => new Set(predecessorStepIds), [predecessorStepIds]);

  // Build available variable references
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

  const agentList = useMemo(() => {
    if (!agents) return [];
    return Object.entries(agents).map(([id, agent]) => ({
      id,
      name: agent.name || id,
    }));
  }, [agents]);

  const selectedAgent = useMemo(() => {
    if (!data.agentId || !agents) return null;
    return agents[data.agentId];
  }, [data.agentId, agents]);

  return (
    <div className="space-y-4">
      {/* Label */}
      <ConfigField label="Label">
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Agent Step"
        />
      </ConfigField>

      {/* Agent Selection */}
      <ConfigField label="Agent" required>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading agents...
          </div>
        ) : (
          <Select
            value={data.agentId ?? ''}
            onValueChange={value => updateNodeData(node.id, { agentId: value || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agentList.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ConfigField>

      {/* Agent Info */}
      {selectedAgent && (
        <ConfigInfoBox>
          <p className="font-medium text-icon5">{selectedAgent.name}</p>
          {selectedAgent.instructions && typeof selectedAgent.instructions === 'string' && (
            <p className="text-icon3 mt-1 line-clamp-2">{selectedAgent.instructions}</p>
          )}
        </ConfigInfoBox>
      )}

      {/* Divider */}
      <div className="border-t border-border1 my-4" />

      {/* Input Section */}
      <div className="space-y-3">
        <SectionHeader
          title="Input"
          icon={<ArrowDownToLine className="w-4 h-4" />}
          expanded={inputExpanded}
          onToggle={() => setInputExpanded(!inputExpanded)}
          badge={availableRefs.length}
        />

        {inputExpanded && (
          <div className="space-y-4 pl-1">
            {/* Prompt Source */}
            <ConfigField label="Prompt Source" hint="Select the data to use as the prompt for this agent">
              <DataReferencePicker
                references={availableRefs}
                value={data.prompt?.$ref}
                onChange={path => updateNodeData(node.id, { prompt: path ? { $ref: path } : null })}
                placeholder="Select prompt source..."
              />
            </ConfigField>

            {/* Instructions Override */}
            <ConfigField label="Instructions Override" hint="Additional instructions for this step (optional)">
              <Textarea
                value={data.instructions ?? ''}
                onChange={e => updateNodeData(node.id, { instructions: e.target.value || undefined })}
                placeholder="Override or extend the agent's default instructions..."
                rows={3}
                className="text-xs"
              />
            </ConfigField>
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
            <OutputReference
              stepId={node.id}
              paths={[
                { path: 'output', description: 'Full response object' },
                { path: 'output.text', description: 'Agent response text' },
              ]}
            />
            <p className="text-[10px] text-icon3 mt-3 pl-1">
              Use these references in downstream steps to access this agent's output.
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
