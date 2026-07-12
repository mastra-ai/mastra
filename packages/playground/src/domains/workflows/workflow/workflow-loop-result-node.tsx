import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { CircleCheck, CircleX } from 'lucide-react';

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
      className={cn('w-[274px] rounded-md bg-surface4')}
      data-workflow-node
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div className="p-2">
        <div className="flex items-center gap-1.5 rounded-sm bg-surface5 p-2  text-sm">
          {result ? <CircleCheck className="size-4 text-current" /> : <CircleX className="size-4 text-current" />}
          <Txt variant="ui-xs" className="text-neutral6 capitalize">
            {String(result)}
          </Txt>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}
