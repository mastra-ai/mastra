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

  describe('when a mapped output flows into both arms of a branch', () => {
    it('offers that output once instead of repeating it per arm', () => {
      const edges: WorkflowDataEdgeModel[] = [
        { id: 'map-short', source: 'node-map', target: 'condition-short', data: { previousStepId: 'mapping_join' } },
        { id: 'map-long', source: 'node-map', target: 'condition-long', data: { previousStepId: 'mapping_join' } },
        { id: 'short-arm', source: 'condition-short', target: 'node-short', data: { previousStepId: 'mapping_join' } },
        { id: 'long-arm', source: 'condition-long', target: 'node-long', data: { previousStepId: 'mapping_join' } },
      ];

      expect(groupWorkflowEdgeData(edges).filter(edge => edge.data?.dataLabelPlacement !== 'hidden')).toEqual([
        expect.objectContaining({ id: 'map-short' }),
      ]);
    });
  });

  describe('when two steps expose different outputs', () => {
    it('keeps each distinct output inspectable', () => {
      const edges: WorkflowDataEdgeModel[] = [
        parallelEdges[0],
        { ...parallelEdges[1], data: { previousStepId: 'another-output' } },
      ];

      expect(groupWorkflowEdgeData(edges).every(edge => edge.data?.dataLabelPlacement === undefined)).toBe(true);
    });
  });

  describe('when a step is named like a workflow boundary', () => {
    it('keeps its output separate from the workflow input group', () => {
      const edges: WorkflowDataEdgeModel[] = [
        { id: 'start-left', source: 'start', target: 'left', data: { boundaryPayload: 'workflow-input' } },
        { id: 'input-right', source: 'workflow-input', target: 'right', data: { previousStepId: 'workflow-input' } },
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
