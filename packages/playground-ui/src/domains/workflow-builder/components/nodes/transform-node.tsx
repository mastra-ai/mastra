import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { TransformNodeData } from '../../types';

const TRANSFORM_COLOR = '#14b8a6'; // teal-500

export const TransformNode = memo(function TransformNode({
  id,
  data,
  selected,
}: NodeProps<Node<TransformNodeData, 'transform'>>) {
  const outputKeys = Object.keys(data.output || {});

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={TRANSFORM_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${TRANSFORM_COLOR}20` }}
          >
            <ArrowRightLeft className="w-4 h-4" style={{ color: TRANSFORM_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-teal-500/20 !text-teal-500">TRANSFORM</Badge>
        </div>

        {outputKeys.length > 0 ? (
          <div className="space-y-1">
            {outputKeys.slice(0, 3).map(key => (
              <div key={key} className="flex items-center gap-2 text-xs text-icon4">
                <span className="font-mono text-icon3">{key}:</span>
                <span className="truncate">
                  {typeof data.output[key] === 'object' ? 'ref' : String(data.output[key])}
                </span>
              </div>
            ))}
            {outputKeys.length > 3 && <div className="text-xs text-icon3">+{outputKeys.length - 3} more fields</div>}
          </div>
        ) : (
          <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1">No output mapping defined</div>
        )}
      </div>
    </BaseNode>
  );
});
