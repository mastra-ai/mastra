import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { PlayCircle } from 'lucide-react';
import { BaseNode } from './base-node';
import type { TriggerNodeData } from '../../types';

const TRIGGER_COLOR = '#22c55e'; // green-500

export const TriggerNode = memo(function TriggerNode({
  id,
  data,
  selected,
}: NodeProps<Node<TriggerNodeData, 'trigger'>>) {
  return (
    <BaseNode
      id={id}
      selected={selected}
      hasTopHandle={false}
      accentColor={TRIGGER_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${TRIGGER_COLOR}20` }}
          >
            <PlayCircle className="w-4 h-4" style={{ color: TRIGGER_COLOR }} />
          </div>
          <div>
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
            <div className="text-xs text-icon3">{data.description || 'Manual trigger'}</div>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});
