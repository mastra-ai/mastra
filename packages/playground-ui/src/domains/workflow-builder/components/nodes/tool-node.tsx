import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Wrench } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { ToolNodeData } from '../../types';

const TOOL_COLOR = '#a855f7'; // purple-500

export const ToolNode = memo(function ToolNode({ id, data, selected }: NodeProps<Node<ToolNodeData, 'tool'>>) {
  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={TOOL_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${TOOL_COLOR}20` }}
          >
            <Wrench className="w-4 h-4" style={{ color: TOOL_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-purple-500/20 !text-purple-500">TOOL</Badge>
        </div>

        {data.toolId ? (
          <div className="text-xs text-icon4 bg-surface2 rounded px-2 py-1 font-mono">{data.toolId}</div>
        ) : (
          <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1">No tool selected</div>
        )}
      </div>
    </BaseNode>
  );
});
