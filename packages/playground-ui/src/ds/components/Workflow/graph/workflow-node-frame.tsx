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
      {children}
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
}
