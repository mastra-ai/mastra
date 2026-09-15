import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import './workflow-boundary.css';
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
        data-boundary-role={data.boundaryRole}
        className="workflow-boundary-rail"
      >
        <Txt variant="ui-xs" className="font-medium">
          {data.label}
        </Txt>
      </div>
      {isStart && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
};
