import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import type { WorkflowBoundaryNodeModel } from './types';
import { Txt } from '@/ds/components/Txt';

export const WorkflowBoundaryNode = ({ data }: NodeProps<WorkflowBoundaryNodeModel>) => {
  const isStart = data.boundaryRole === 'start';

  return (
    <>
      {!isStart && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div
        data-workflow-boundary-node
        data-testid={`workflow-boundary-${data.boundaryRole}`}
        className="border-border1 bg-surface3 text-neutral5 flex size-14 items-center justify-center rounded-full border"
      >
        <Txt variant="ui-xs" className="font-medium">
          {data.label}
        </Txt>
      </div>
      {isStart && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
};
