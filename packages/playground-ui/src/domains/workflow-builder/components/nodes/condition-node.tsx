import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { ConditionNodeData, ConditionBranch } from '../../types';

const CONDITION_COLOR = '#eab308'; // yellow-500

export const ConditionNode = memo(function ConditionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ConditionNodeData;
  // Calculate total handles: one for each branch + one for default if present
  const totalHandles = nodeData.branches.length + (nodeData.defaultBranch ? 1 : 0);

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={CONDITION_COLOR}
      bottomHandleCount={Math.max(totalHandles, 2)}
      quickAddExcludeTypes={['trigger']}
      comment={nodeData.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${CONDITION_COLOR}20` }}
          >
            <GitBranch className="w-4 h-4" style={{ color: CONDITION_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{nodeData.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-yellow-500/20 !text-yellow-500">CONDITION</Badge>
        </div>

        <div className="space-y-1">
          {nodeData.branches.map((branch: ConditionBranch, i: number) => (
            <div key={branch.id} className="flex items-center gap-2 text-xs text-icon4">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CONDITION_COLOR }} />
              <span>{branch.label || `Branch ${i + 1}`}</span>
              {branch.condition ? (
                <span className="text-icon3 truncate">({branch.condition.type})</span>
              ) : (
                <span className="text-icon3">(not configured)</span>
              )}
            </div>
          ))}
          {nodeData.defaultBranch && (
            <div className="flex items-center gap-2 text-xs text-icon4">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>Default</span>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
