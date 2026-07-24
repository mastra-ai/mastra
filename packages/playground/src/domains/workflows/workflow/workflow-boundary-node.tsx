import { Txt } from '@mastra/playground-ui/components/Txt';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

import type { WorkflowBoundaryNode as WorkflowBoundaryNodeType } from './workflow-step-node-utils';

export const WorkflowBoundaryNode = ({ data }: NodeProps<WorkflowBoundaryNodeType>) => {
  const isStart = data.boundaryRole === 'start';

  return (
    <>
      {!isStart && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div
        data-workflow-boundary-node
        data-testid={`workflow-boundary-${data.boundaryRole}`}
        className="border-border1 bg-surface3 text-neutral5 flex h-14 w-14 items-center justify-center rounded-full border"
      >
        <Txt variant="ui-xs" className="font-medium">
          {data.label}
        </Txt>
      </div>
      {isStart && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
};
