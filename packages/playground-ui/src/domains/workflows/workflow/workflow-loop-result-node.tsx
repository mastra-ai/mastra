import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { CircleCheck, CircleX } from 'lucide-react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type LoopResultNode = Node<
  {
    result: boolean;
  },
  'loop-result-node'
>;

export function WorkflowLoopResultNode({ data }: NodeProps<LoopResultNode>) {
  const { result } = data;
  return (
    <div
      data-testid="workflow-loop-result-node"
      data-workflow-step-status={result ? 'success' : 'failed'}
      className={cn('bg-surface4 rounded-md w-[274px]')}
      data-workflow-node
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div className="p-2">
        <div className="text-sm bg-surface5 flex items-center gap-1.5 rounded-sm  p-2">
          {result ? <CircleCheck className="text-current w-4 h-4" /> : <CircleX className="text-current w-4 h-4" />}
          <Txt variant="ui-xs" className="text-neutral6 capitalize">
            {String(result)}
          </Txt>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}
