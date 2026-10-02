import type { FitViewOptions } from '@xyflow/react';
import { createContext } from 'react';

export const WorkflowCanvasInsetContext = createContext(0);

export function workflowFitOptions(leftInset: number, isInline = false): FitViewOptions {
  return {
    maxZoom: 1,
    padding: isInline ? '20px' : { left: `${leftInset + 40}px`, right: '40px', top: '40px', bottom: '64px' },
  };
}
