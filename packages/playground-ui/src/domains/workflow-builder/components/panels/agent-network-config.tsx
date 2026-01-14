import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { BuilderNode, AgentNetworkNodeData } from '../../types';
import { useWorkflowBuilderStore } from '../../store/workflow-builder-store';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { Label } from '@/ds/components/Label';
import { Textarea } from '@/ds/components/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';

export interface AgentNetworkConfigProps {
  node: BuilderNode;
}

export function AgentNetworkConfig({ node }: AgentNetworkConfigProps) {
  const data = node.data as AgentNetworkNodeData;
  const updateNodeData = useWorkflowBuilderStore(state => state.updateNodeData);
  const { data: agents, isLoading } = useAgents();
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  const agentList = useMemo(() => {
    if (!agents) return [];
    return Object.entries(agents).map(([id, agent]) => ({
      id,
      name: agent.name || id,
    }));
  }, [agents]);

  // Build available variable references for prompt
  const availableRefs = useMemo(() => {
    const refs: Array<{ path: string; label: string }> = [];

    // Add input schema fields
    if (inputSchema && typeof inputSchema === 'object') {
      const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const key of Object.keys(properties)) {
          refs.push({ path: `input.${key}`, label: `Workflow Input: ${key}` });
        }
      }
    }

    // Add step outputs
    for (const n of nodes) {
      if (n.id === node.id || n.data.type === 'trigger') continue;
      refs.push({ path: `steps.${n.id}.output`, label: `${n.data.label}: Output` });
      if (n.data.type === 'agent') {
        refs.push({ path: `steps.${n.id}.output.text`, label: `${n.data.label}: text` });
      }
    }

    return refs;
  }, [nodes, node.id, inputSchema]);

  const toggleAgent = (agentId: string) => {
    const newAgents = data.agents.includes(agentId)
      ? data.agents.filter(id => id !== agentId)
      : [...data.agents, agentId];
    updateNodeData(node.id, { agents: newAgents });
  };

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Label</Label>
        <input
          type="text"
          value={data.label}
          onChange={e => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Agent Network"
          className="w-full h-8 px-3 text-sm rounded border border-border1 bg-surface1 text-icon6 focus:outline-none focus:border-accent1"
        />
      </div>

      {/* Info - AI Differentiator */}
      <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded text-[10px] text-violet-400">
        <strong>Mastra-exclusive feature:</strong> Agent networks enable multi-agent collaboration where agents can
        delegate tasks and share context. This is not available in n8n or similar tools.
      </div>

      {/* Routing Strategy */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Routing Strategy</Label>
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
        <p className="text-[10px] text-icon3">
          {data.routingStrategy === 'round-robin' && 'Distribute requests evenly across agents'}
          {data.routingStrategy === 'capability' && 'Route to agents based on their capabilities'}
          {data.routingStrategy === 'priority' && 'Use primary agent, fallback to others if needed'}
        </p>
      </div>

      {/* Agents Selection */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Agents in Network ({data.agents.length})</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-icon3 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading agents...
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {agentList.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors ${
                  data.agents.includes(agent.id)
                    ? 'bg-violet-500/20 border border-violet-500/30'
                    : 'bg-surface2 border border-border1 hover:border-border2'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    data.agents.includes(agent.id) ? 'bg-violet-500 border-violet-500' : 'border-icon4'
                  }`}
                >
                  {data.agents.includes(agent.id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-icon6">{agent.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prompt Source */}
      <div className="space-y-1.5">
        <Label className="text-xs text-icon5">Prompt Source</Label>
        <Select
          value={data.prompt?.$ref ?? ''}
          onValueChange={value => updateNodeData(node.id, { prompt: value ? { $ref: value } : null })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select prompt source..." />
          </SelectTrigger>
          <SelectContent>
            {availableRefs.map(ref => (
              <SelectItem key={ref.path} value={ref.path}>
                {ref.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-icon3">The input prompt that will be processed by the agent network</p>
      </div>

      {/* Output Reference */}
      <div className="border-t border-border1 pt-4">
        <Label className="text-xs text-icon5">Output Reference</Label>
        <div className="mt-2 p-3 bg-surface2 rounded-lg">
          <p className="text-xs text-icon4 mb-2">Network response will be available at:</p>
          <code className="block text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
            steps.{node.id}.output
          </code>
          <code className="block mt-1 text-xs font-mono text-icon6 bg-surface3 px-2 py-1 rounded">
            steps.{node.id}.output.agentId
          </code>
          <p className="text-[10px] text-icon3 mt-2">The agentId field indicates which agent handled the request</p>
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
