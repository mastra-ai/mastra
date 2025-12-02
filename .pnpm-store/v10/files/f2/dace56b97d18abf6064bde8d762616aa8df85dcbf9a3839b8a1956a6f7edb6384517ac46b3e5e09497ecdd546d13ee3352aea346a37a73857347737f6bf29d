import { type EdgePosition } from '@xyflow/system';
import type { EdgeWrapperProps, Edge } from '../../types/edges';
type EdgeUpdateAnchorsProps<EdgeType extends Edge = Edge> = {
    edge: EdgeType;
    isReconnectable: boolean | 'source' | 'target';
    reconnectRadius: EdgeWrapperProps['reconnectRadius'];
    onReconnect: EdgeWrapperProps<EdgeType>['onReconnect'];
    onReconnectStart: EdgeWrapperProps<EdgeType>['onReconnectStart'];
    onReconnectEnd: EdgeWrapperProps<EdgeType>['onReconnectEnd'];
    setUpdateHover: (hover: boolean) => void;
    setReconnecting: (updating: boolean) => void;
} & EdgePosition;
export declare function EdgeUpdateAnchors<EdgeType extends Edge = Edge>({ isReconnectable, reconnectRadius, edge, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, onReconnect, onReconnectStart, onReconnectEnd, setReconnecting, setUpdateHover, }: EdgeUpdateAnchorsProps<EdgeType>): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=EdgeUpdateAnchors.d.ts.map