import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { AgentNodeData } from '../../types';

const AGENT_COLOR = '#3b82f6'; // blue-500

export const AgentNode = memo(function AgentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={AGENT_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={nodeData.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${AGENT_COLOR}20` }}
          >
            <Bot className="w-4 h-4" style={{ color: AGENT_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{nodeData.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-blue-500/20 !text-blue-500">AGENT</Badge>
        </div>

        {nodeData.agentId ? (
          <div className="text-xs text-icon4 bg-surface2 rounded px-2 py-1 font-mono">{nodeData.agentId}</div>
        ) : (
          <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1">No agent selected</div>
        )}
      </div>
    </BaseNode>
  );
});
