import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { CircleCheck, CircleX } from 'lucide-react';

import { Text } from '@/components/ui/text';

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
    <div className={cn('bg-mastra-bg-8 rounded-md w-[274px]')}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div className="p-2">
        <div className="text-sm bg-mastra-bg-9 flex items-center gap-[6px] rounded-sm  p-2">
          {result ? <CircleCheck className="text-current w-4 h-4" /> : <CircleX className="text-current w-4 h-4" />}
          <Text size="xs" weight="medium" className="text-mastra-el-6 capitalize">
            {String(result)}
          </Text>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}
