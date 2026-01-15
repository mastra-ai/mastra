import { useMemo, useState } from 'react';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, Check, Users } from 'lucide-react';
import type { BuilderNode, AgentNetworkNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { usePredecessorIds } from '../../hooks/use-graph-utils';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ConfigField,
  ConfigInfoBox,
  DataReferencePicker,
  OutputReference,
  SectionHeader,
  type DataReference,
} from './shared';

export interface AgentNetworkConfigProps {
  node: BuilderNode;
}

export function AgentNetworkConfig({ node }: AgentNetworkConfigProps) {
  const data = node.data as AgentNetworkNodeData;
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

  const agentList = useMemo(() => {
    if (!agents) return [];
    return Object.entries(agents).map(([id, agent]) => ({
      id,
      name: agent.name || id,
      instructions: typeof agent.instructions === 'string' ? agent.instructions : undefined,
    }));
  }, [agents]);

  // Build available variable references for prompt (only from predecessors)
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

  const toggleAgent = (agentId: string) => {
    const newAgents = data.agents.includes(agentId)
      ? data.agents.filter(id => id !== agentId)
      : [...data.agents, agentId];
    updateNodeData(node.id, { agents: newAgents });
  };

  // Get routing strategy description
  const routingDescription = {
    'round-robin': 'Distribute requests evenly across agents',
    capability: 'Route to agents based on their capabilities',
    priority: 'Use primary agent, fallback to others if needed',
  }[data.routingStrategy];

  return (
    <div className="space-y-4">
      {/* Label */}
      <ConfigField label="Label">
        <Input
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Agent Network"
        />
      </ConfigField>

      {/* Info - AI Differentiator */}
      <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded text-[10px] text-violet-400">
        <strong>Mastra-exclusive feature:</strong> Agent networks enable multi-agent collaboration where agents can
        delegate tasks and share context.
      </div>

      {/* Routing Strategy */}
      <ConfigField label="Routing Strategy" hint={routingDescription}>
        <Select
          value={data.routingStrategy}
          onValueChange={value =>
            updateNodeData(node.id, { routingStrategy: value as 'round-robin' | 'capability' | 'priority' })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round-robin">Round Robin</SelectItem>
            <SelectItem value="capability">Capability-Based</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </ConfigField>

      {/* Agents Selection */}
      <ConfigField label={`Agents in Network (${data.agents.length})`} required>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading agents...
          </div>
        ) : agentList.length === 0 ? (
          <ConfigInfoBox variant="warning">
            No agents available. Create agents in your Mastra configuration to use agent networks.
          </ConfigInfoBox>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto p-1">
            {agentList.map(agent => {
              const isSelected = data.agents.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-violet-500/20 border border-violet-500/40'
                      : 'bg-surface3 border border-border1 hover:border-border2'
                  }`}
                >
                  <div
                    className={`w-4 h-4 mt-0.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-violet-500 border-violet-500' : 'border-icon4'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-icon6 block">{agent.name}</span>
                    {agent.instructions && (
                      <span className="text-[10px] text-icon3 block mt-0.5 line-clamp-1">{agent.instructions}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ConfigField>

      {/* Selected agents summary */}
      {data.agents.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 rounded-lg">
          <Users className="w-4 h-4 text-violet-400" />
          <span className="text-xs text-violet-400">
            {data.agents.length} agent{data.agents.length !== 1 ? 's' : ''} selected
          </span>
        </div>
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
            <ConfigField label="Prompt Source" hint="The input prompt that will be processed by the agent network">
              <DataReferencePicker
                references={availableRefs}
                value={data.prompt?.$ref}
                onChange={path => updateNodeData(node.id, { prompt: path ? { $ref: path } : null })}
                placeholder="Select prompt source..."
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
                { path: 'output', description: 'Full network response' },
                { path: 'output.text', description: 'Response text' },
                { path: 'output.agentId', description: 'ID of handling agent' },
              ]}
            />
            <p className="text-[10px] text-icon3 mt-3 pl-1">
              The agentId field indicates which agent in the network handled the request.
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
