import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import type { WorkflowBoundaryNodeModel } from './types';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

export const WorkflowBoundaryNode = ({ data }: NodeProps<WorkflowBoundaryNodeModel>) => {
  const isStart = data.boundaryRole === 'start';

  return (
    <>
      {!isStart && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div
        data-workflow-boundary-node
        data-testid={`workflow-boundary-${data.boundaryRole}`}
        className={cn(
          'relative flex h-[38px] w-28 items-center justify-center text-neutral4 after:absolute after:inset-x-0 after:mask-x-from-60%',
          isStart
            ? 'after:bottom-0 after:h-px after:bg-neutral3'
            : 'after:top-0 after:h-1 after:border-y after:border-neutral3',
        )}
      >
        <Txt variant="ui-xs" className="font-medium">
          {data.label}
        </Txt>
      </div>
      {isStart && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
};
