import { EdgePosition } from '../../types/edges';
import { ConnectionMode, OnError } from '../../types/general';
import { InternalNodeBase } from '../../types/nodes';
import { Position, XYPosition } from '../../types/utils';
import { Handle } from '../../types';
export type GetEdgePositionParams = {
    id: string;
    sourceNode: InternalNodeBase;
    sourceHandle: string | null;
    targetNode: InternalNodeBase;
    targetHandle: string | null;
    connectionMode: ConnectionMode;
    onError?: OnError;
};
export declare function getEdgePosition(params: GetEdgePositionParams): EdgePosition | null;
export declare function getHandlePosition(node: InternalNodeBase, handle: Handle | null, fallbackPosition?: Position, center?: boolean): XYPosition;
//# sourceMappingURL=positions.d.ts.map