// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkflowGraphNodes } from '../use-workflow-graph-nodes';

describe('when a workflow card expands', () => {
  it('moves its successors below the measured body and closes the gap after collapse', () => {
    const stepGraph: SerializedStepFlowEntry[] = [
      { type: 'step', step: { id: 'loop-body' } },
      { type: 'step', step: { id: 'collect-results' } },
    ];
    const { result } = renderHook(() => useWorkflowGraphNodes(stepGraph));
    const measureBody = (height: number) =>
      act(() =>
        result.current.onNodesChange([
          { type: 'dimensions', id: 'node-loop-body', dimensions: { width: 274, height } },
        ]),
      );

    measureBody(360);
    const expandedBody = result.current.nodes.find(node => node.id === 'node-loop-body');
    const expandedSuccessor = result.current.nodes.find(node => node.id === 'node-collect-results');
    expect(expandedBody).toBeDefined();
    expect(expandedSuccessor).toBeDefined();
    expect(expandedSuccessor?.position.y).toBeGreaterThan(expandedBody?.position.y + 360);

    measureBody(120);
    const collapsedSuccessor = result.current.nodes.find(node => node.id === 'node-collect-results');
    expect(collapsedSuccessor?.position.y).toBe((expandedSuccessor?.position.y ?? 0) - 240);
  });

  it('keeps the top center of the expanded card anchored when its width changes', () => {
    const stepGraph: SerializedStepFlowEntry[] = [{ type: 'step', step: { id: 'loop-body' } }];
    const { result } = renderHook(() => useWorkflowGraphNodes(stepGraph));
    act(() =>
      result.current.onNodesChange([
        { type: 'dimensions', id: 'node-loop-body', dimensions: { width: 274, height: 120 } },
      ]),
    );
    const before = result.current.nodes.find(node => node.id === 'node-loop-body');
    act(() =>
      result.current.onNodesChange([
        { type: 'dimensions', id: 'node-loop-body', dimensions: { width: 688, height: 820 } },
      ]),
    );
    const after = result.current.nodes.find(node => node.id === 'node-loop-body');
    if (!before || !after) throw new Error('loop body node missing');
    expect(after.position.x + 688 / 2).toBe(before.position.x + 274 / 2);
    expect(after.position.y).toBe(before.position.y);
  });
});
