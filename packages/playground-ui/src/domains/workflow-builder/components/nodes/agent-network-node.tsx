import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Network } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { AgentNetworkNodeData } from '../../types';

const NETWORK_COLOR = '#8b5cf6'; // violet-500

const ROUTING_LABELS: Record<string, string> = {
  'round-robin': 'Round Robin',
  capability: 'Capability-Based',
  priority: 'Priority',
};

export const AgentNetworkNode = memo(function AgentNetworkNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNetworkNodeData;

  const agentCount = nodeData.agents?.length || 0;

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={NETWORK_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={nodeData.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${NETWORK_COLOR}20` }}
          >
            <Network className="w-4 h-4" style={{ color: NETWORK_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{nodeData.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-violet-500/20 !text-violet-500">NETWORK</Badge>
        </div>

        {nodeData.networkId ? (
          <div className="space-y-1">
            <div className="text-xs text-icon4 bg-surface2 rounded px-2 py-1 font-mono truncate">
              {nodeData.networkId}
            </div>
            <div className="flex items-center gap-4 text-xs text-icon4">
              <div className="flex items-center gap-1">
                <span className="text-icon3">Agents:</span>
                <span>{agentCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-icon3">Routing:</span>
                <span>{ROUTING_LABELS[nodeData.routingStrategy] || nodeData.routingStrategy}</span>
              </div>
            </div>
            {/* Mini agent avatars */}
            {agentCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {nodeData.agents.slice(0, 4).map((agentId, i) => (
                  <div
                    key={agentId}
                    className="w-5 h-5 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] text-violet-300"
                    title={agentId}
                  >
                    {agentId.charAt(0).toUpperCase()}
                  </div>
                ))}
                {agentCount > 4 && <div className="text-xs text-icon3">+{agentCount - 4}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1">No network selected</div>
        )}
      </div>
    </BaseNode>
  );
});
