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
    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('idle');
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
    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('success');
  });

  it('does not light the conditional edge of a skipped branch arm', () => {
    // After a conditional resolves, the un-taken arm is persisted as `skipped`. Its incoming
    // condition edge must stay idle (grey) so the graph does not show the wrong branch as taken.
    const conditionalContext = {
      result: {
        status: 'paused',
        steps: {
          'short-text': { status: 'skipped', startedAt: Date.now() },
          'long-text': { status: 'success', output: { text: 'HELLOABHELLOAC' }, startedAt: Date.now() },
        },
      },
      debugMode: false,
    } as React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

    const conditionalWrapper = ({ children }: PropsWithChildren) => (
      <WorkflowRunContext.Provider value={conditionalContext}>{children}</WorkflowRunContext.Provider>
    );

    const edges: Edge[] = [
      {
        id: 'e-condition-short-text',
        source: 'condition',
        target: 'short-text',
        data: { nextStepId: 'short-text', conditionNode: true },
      },
      {
        id: 'e-condition-long-text',
        source: 'condition',
        target: 'long-text',
        data: { nextStepId: 'long-text', conditionNode: true },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper: conditionalWrapper });

    const shortEdge = result.current.styledEdges.find(edge => edge.id === 'e-condition-short-text');
    const longEdge = result.current.styledEdges.find(edge => edge.id === 'e-condition-long-text');

    expect(shortEdge?.data?.edgeStatus).toBe('idle');
    expect(longEdge?.data?.edgeStatus).toBe('success');
  });

  it('keeps the workflow-input boundary edge idle before the first step starts', () => {
    const idleContext = {
      result: {
        status: 'running',
        steps: {},
      },
      debugMode: false,
    } as React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

    const idleWrapper = ({ children }: PropsWithChildren) => (
      <WorkflowRunContext.Provider value={idleContext}>{children}</WorkflowRunContext.Provider>
    );

    const edges: Edge[] = [
      {
        id: 'e-__workflow-start__-add-letter',
        source: '__workflow-start__',
        target: 'add-letter',
        data: { boundaryPayload: 'workflow-input', nextStepId: 'add-letter' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper: idleWrapper });

    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('idle');
    expect(result.current.styledEdges[0].style?.stroke).toBe('#8e8e8e');
  });

  it('lights the workflow-input boundary edge green once the first step starts', () => {
    const edges: Edge[] = [
      {
        id: 'e-__workflow-start__-transform',
        source: '__workflow-start__',
        target: 'transform',
        animated: true,
        style: { strokeDasharray: '5 5' },
        data: { boundaryPayload: 'workflow-input', nextStepId: 'transform' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper });

    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('success');
    expect(result.current.styledEdges[0].style?.stroke).toBe('#22c55e');
    expect(result.current.styledEdges[0].style?.strokeDasharray).toBe('none');
    expect(result.current.styledEdges[0].animated).toBe(false);
  });

  it('keeps the workflow-input boundary edge idle for a skipped first step', () => {
    const skippedContext = {
      result: {
        status: 'running',
        steps: {
          'add-letter': { status: 'skipped', startedAt: Date.now() },
        },
      },
      debugMode: false,
    } as React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

    const skippedWrapper = ({ children }: PropsWithChildren) => (
      <WorkflowRunContext.Provider value={skippedContext}>{children}</WorkflowRunContext.Provider>
    );

    const edges: Edge[] = [
      {
        id: 'e-__workflow-start__-add-letter',
        source: '__workflow-start__',
        target: 'add-letter',
        data: { boundaryPayload: 'workflow-input', nextStepId: 'add-letter' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper: skippedWrapper });

    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('idle');
    expect(result.current.styledEdges[0].style?.stroke).toBe('#8e8e8e');
  });

  it('keeps the workflow-output boundary edge idle until the run succeeds', () => {
    // The boundary edge into the End node carries no step ids, so it cannot rely on a
    // predecessor step. It should only light once the whole run reaches `success`.
    const edges: Edge[] = [
      {
        id: 'e-final-step-__workflow-end__',
        source: 'final-step',
        target: '__workflow-end__',
        data: { boundaryPayload: 'workflow-output' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper });

    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('idle');
  });

  it('lights the workflow-output boundary edge green once the run succeeds', () => {
    const successContext = {
      result: {
        status: 'success',
        result: { output: true },
        steps: {
          'final-step': { status: 'success', output: { output: true }, startedAt: Date.now() },
        },
      },
      debugMode: false,
    } as React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

    const successWrapper = ({ children }: PropsWithChildren) => (
      <WorkflowRunContext.Provider value={successContext}>{children}</WorkflowRunContext.Provider>
    );

    const edges: Edge[] = [
      {
        id: 'e-final-step-__workflow-end__',
        source: 'final-step',
        target: '__workflow-end__',
        data: { boundaryPayload: 'workflow-output' },
      },
    ];

    const { result } = renderHook(() => useWorkflowGraphRuntime({ edges }), { wrapper: successWrapper });

    expect(result.current.styledEdges[0].data?.edgeStatus).toBe('success');
    expect(result.current.styledEdges[0].style?.stroke).toBe('#22c55e');
  });
});
