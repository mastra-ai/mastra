import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { LoopNodeData } from '../../types';

const LOOP_COLOR = '#f97316'; // orange-500

export const LoopNode = memo(function LoopNode({ id, data, selected }: NodeProps<Node<LoopNodeData, 'loop'>>) {
  const loopTypeLabel = data.loopType === 'dowhile' ? 'Do While' : 'Do Until';

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={LOOP_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${LOOP_COLOR}20` }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: LOOP_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-orange-500/20 !text-orange-500">LOOP</Badge>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-icon4">
            <span className="text-icon3">Type:</span>
            <span>{loopTypeLabel}</span>
          </div>
          {data.condition ? (
            <div className="flex items-center gap-2 text-icon4">
              <span className="text-icon3">Condition:</span>
              <span className="truncate">{data.condition.type}</span>
            </div>
          ) : (
            <div className="text-amber-500 bg-amber-500/10 rounded px-2 py-1">No condition set</div>
          )}
          {data.maxIterations && (
            <div className="flex items-center gap-2 text-icon4">
              <span className="text-icon3">Max:</span>
              <span>{data.maxIterations} iterations</span>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
