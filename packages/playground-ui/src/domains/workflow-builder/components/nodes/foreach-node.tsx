import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { List } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { ForeachNodeData } from '../../types';

const FOREACH_COLOR = '#ec4899'; // pink-500

export const ForeachNode = memo(function ForeachNode({
  id,
  data,
  selected,
}: NodeProps<Node<ForeachNodeData, 'foreach'>>) {
  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={FOREACH_COLOR}
      quickAddExcludeTypes={['trigger']}
      showComment={false}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${FOREACH_COLOR}20` }}
          >
            <List className="w-4 h-4" style={{ color: FOREACH_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-pink-500/20 !text-pink-500">FOREACH</Badge>
        </div>

        <div className="space-y-1 text-xs">
          {data.collection ? (
            <div className="text-icon4 bg-surface2 rounded px-2 py-1 font-mono truncate">
              {data.collection.$ref || 'collection'}
            </div>
          ) : (
            <div className="text-amber-500 bg-amber-500/10 rounded px-2 py-1">No collection set</div>
          )}
          <div className="flex items-center gap-4 text-icon4">
            <div className="flex items-center gap-1">
              <span className="text-icon3">Item:</span>
              <span className="font-mono">{data.itemVariable || 'item'}</span>
            </div>
            {data.concurrency && data.concurrency > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-icon3">Parallel:</span>
                <span>{data.concurrency}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseNode>
  );
});
