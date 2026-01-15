import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { GitMerge } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { ParallelNodeData, ParallelBranch } from '../../types';

const PARALLEL_COLOR = '#06b6d4'; // cyan-500

export const ParallelNode = memo(function ParallelNode({
  id,
  data,
  selected,
}: NodeProps<Node<ParallelNodeData, 'parallel'>>) {
  const branchCount = data.branches?.length || 2;

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={PARALLEL_COLOR}
      bottomHandleCount={branchCount}
      quickAddExcludeTypes={['trigger']}
      showComment={false}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${PARALLEL_COLOR}20` }}
          >
            <GitMerge className="w-4 h-4" style={{ color: PARALLEL_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-cyan-500/20 !text-cyan-500">PARALLEL</Badge>
        </div>

        <div className="space-y-1">
          {data.branches?.map((branch: ParallelBranch, i: number) => (
            <div key={branch.id} className="flex items-center gap-2 text-xs text-icon4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PARALLEL_COLOR }} />
              <span>{branch.label || `Branch ${i + 1}`}</span>
            </div>
          ))}
        </div>
      </div>
    </BaseNode>
  );
});
