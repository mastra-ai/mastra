// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Edge } from '@xyflow/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { useWorkflowGraphRuntime } from '../use-workflow-graph-runtime';
import { WORKFLOW_DATA_EDGE_TYPE } from '../workflow-data-edge';
import { WORKFLOW_BOUNDARY_NODE_TYPE } from '../workflow-step-node-utils';

const workflowRunContextValue = {
  result: {
    status: 'running',
    steps: {
      extract: {
        status: 'success',
        payload: { request: true },
        output: { customerId: 'cus_123' },
        startedAt: Date.now(),
      },
      transform: {
        status: 'running',
        payload: { customerId: 'cus_123' },
        startedAt: Date.now(),
      },
    },
  },
  debugMode: false,
} as React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

const wrapper = ({ children }: PropsWithChildren) => (
  <WorkflowRunContext.Provider value={workflowRunContextValue}>{children}</WorkflowRunContext.Provider>
);

describe('useWorkflowGraphRuntime', () => {
  it('registers the workflow data edge type and applies it to workflow edges', () => {
    const edges: Edge[] = [
      {
        id: 'e-extract-transform',
        source: 'extract',
        target: 'transform',
        data: { previousStepId: 'extract', nextStepId: 'transform' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper });

    expect(result.current.edgeTypes[WORKFLOW_DATA_EDGE_TYPE]).toEqual(expect.any(Function));
    expect(result.current.nodeTypes[WORKFLOW_BOUNDARY_NODE_TYPE]).toEqual(expect.any(Function));
    expect(result.current.styledEdges[0].type).toBe(WORKFLOW_DATA_EDGE_TYPE);
  });

  it('renders unfinished edges in gray instead of the default white stroke', () => {
    const edges: Edge[] = [
      {
        id: 'e-transform-load',
        source: 'transform',
        target: 'load',
        data: { previousStepId: 'transform', nextStepId: 'load' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper });

    expect(result.current.styledEdges[0].style?.stroke).toBe('#8e8e8e');
  });

  it('renders finished green edges as solid instead of animated', () => {
    const edges: Edge[] = [
      {
        id: 'e-extract-transform',
        source: 'extract',
        target: 'transform',
        animated: true,
        style: { strokeDasharray: '5 5' },
        data: { previousStepId: 'extract', nextStepId: 'transform' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper });

    expect(result.current.styledEdges[0].style?.stroke).toBe('#22c55e');
    expect(result.current.styledEdges[0].style?.strokeDasharray).toBe('none');
    expect(result.current.styledEdges[0].animated).toBe(false);
  });
});
