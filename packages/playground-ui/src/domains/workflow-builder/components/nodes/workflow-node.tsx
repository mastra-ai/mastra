import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/ds/components/Badge';
import type { WorkflowNodeData } from '../../types';

const WORKFLOW_COLOR = '#6366f1'; // indigo-500

export const WorkflowNode = memo(function WorkflowNode({
  id,
  data,
  selected,
}: NodeProps<Node<WorkflowNodeData, 'workflow'>>) {
  const inputCount = Object.keys(data.input || {}).length;

  return (
    <BaseNode
      id={id}
      selected={selected}
      accentColor={WORKFLOW_COLOR}
      quickAddExcludeTypes={['trigger']}
      comment={data.comment}
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${WORKFLOW_COLOR}20` }}
          >
            <Workflow className="w-4 h-4" style={{ color: WORKFLOW_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-icon6 text-sm">{data.label}</div>
          </div>
          <Badge className="text-[10px] px-1.5 py-0.5 !bg-indigo-500/20 !text-indigo-500">WORKFLOW</Badge>
        </div>

        {data.workflowId ? (
          <div className="space-y-1">
            <div className="text-xs text-icon4 bg-surface2 rounded px-2 py-1 font-mono truncate">{data.workflowId}</div>
            {inputCount > 0 && (
              <div className="text-xs text-icon4">
                {inputCount} input{inputCount !== 1 ? 's' : ''} mapped
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-amber-500 bg-amber-500/10 rounded px-2 py-1">No workflow selected</div>
        )}
      </div>
    </BaseNode>
  );
});
