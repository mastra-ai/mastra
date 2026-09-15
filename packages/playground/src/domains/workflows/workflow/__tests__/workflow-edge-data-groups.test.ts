import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';
import { describe, expect, it } from 'vitest';
import { groupWorkflowEdgeData } from '../data/workflow-edge-data-groups';

const parallelEdges: WorkflowDataEdgeModel[] = [
  { id: 'prepare-left', source: 'prepare', target: 'left', data: { previousStepId: 'prepare' } },
  { id: 'prepare-right', source: 'prepare', target: 'right', data: { previousStepId: 'prepare' } },
  { id: 'left-join', source: 'left', target: 'join', data: { previousStepId: 'left' } },
  { id: 'right-join', source: 'right', target: 'join', data: { previousStepId: 'right' } },
];

describe('Workflow edge data groups', () => {
  describe('when one output feeds parallel paths', () => {
    it('offers the shared output once while preserving both branch outputs and all connections', () => {
      const grouped = groupWorkflowEdgeData(parallelEdges);

      expect(
        grouped.filter(edge => edge.data?.dataLabelPlacement !== 'hidden').map(edge => edge.data?.previousStepId),
      ).toEqual(['prepare', 'left', 'right']);
      expect(grouped[0].data?.dataLabelPlacement).toBe('source');
      expect(grouped.map(edge => [edge.source, edge.target])).toEqual(
        parallelEdges.map(edge => [edge.source, edge.target]),
      );
      expect(parallelEdges.every(edge => edge.data?.dataLabelPlacement === undefined)).toBe(true);
    });
  });

  describe('when a workflow starts with three parallel paths', () => {
    it('offers workflow input once at the shared source', () => {
      const edges: WorkflowDataEdgeModel[] = ['left', 'middle', 'right'].map(target => ({
        id: `start-${target}`,
        source: 'start',
        target,
        data: { boundaryPayload: 'workflow-input' },
      }));
      const grouped = groupWorkflowEdgeData(edges);

      expect(grouped.filter(edge => edge.data?.dataLabelPlacement === 'source')).toHaveLength(1);
      expect(grouped.filter(edge => edge.data?.dataLabelPlacement === 'hidden')).toHaveLength(2);
    });
  });

  describe('when one node exposes different data or source handles', () => {
    it('keeps each distinct connection inspectable', () => {
      const edges: WorkflowDataEdgeModel[] = [
        parallelEdges[0],
        { ...parallelEdges[1], data: { previousStepId: 'another-output' } },
        { ...parallelEdges[1], id: 'alternate-handle', sourceHandle: 'alternate' },
      ];

      expect(groupWorkflowEdgeData(edges).every(edge => edge.data?.dataLabelPlacement === undefined)).toBe(true);
    });
  });

  describe('when steps run in sequence', () => {
    it('retains the individual data controls', () => {
      expect(groupWorkflowEdgeData(parallelEdges.slice(2))).toEqual(parallelEdges.slice(2));
    });
  });
});
