import { DataEdge } from './data-edge';
import type { EdgeTypes } from '@xyflow/react';

export { DataEdge } from './data-edge';
export type { DataEdgeData } from './data-edge';

/**
 * Edge type registry for React Flow
 */
export const edgeTypes: EdgeTypes = {
  data: DataEdge,
};
