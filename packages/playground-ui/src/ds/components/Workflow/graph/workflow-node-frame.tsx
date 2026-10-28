import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';

export interface WorkflowNodeFrameProps {
  withoutTopHandle?: boolean;
  withoutBottomHandle?: boolean;
  children: ReactNode;
}

export function WorkflowNodeFrame({ withoutTopHandle, withoutBottomHandle, children }: WorkflowNodeFrameProps) {
  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <div className="nodrag pointer-events-auto">{children}</div>
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
}
