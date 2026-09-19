import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';
import { branchWorkflow, parallelWorkflow, twoStepWorkflow } from './fixtures/workflow-debug-step-controls';

describe('Workflow graph connections', () => {
  describe('when a step leads into conditional branches', () => {
    it('creates one data connection per condition and retains both branches', () => {
      const { edges } = constructNodesAndEdges({ stepGraph: branchWorkflow.stepGraph });

      expect(edges).toHaveLength(9);
      expect(edges.map(edge => [edge.source, edge.target])).toEqual(
        expect.arrayContaining([
          ['boundary-start', 'node-start'],
          ['node-start', 'condition-node-cond-short'],
          ['node-start', 'condition-node-cond-long'],
          ['condition-node-cond-short', 'node-short-text'],
          ['node-short-text', 'node-mapping_join'],
          ['condition-node-cond-long', 'node-long-text'],
          ['node-long-text', 'node-mapping_join'],
          ['node-mapping_join', 'node-final'],
          ['node-final', 'boundary-end'],
        ]),
      );
      expect(edges.find(edge => edge.target === 'condition-node-cond-short')?.data?.conditionNode).toBe(true);
    });
  });

  describe('when two steps run in sequence', () => {
    it('creates one connection per transition for inspecting its data', () => {
      const { edges } = constructNodesAndEdges({ stepGraph: twoStepWorkflow.stepGraph });

      expect(edges).toHaveLength(3);
      expect(edges.map(edge => [edge.source, edge.target])).toEqual(
        expect.arrayContaining([
          ['boundary-start', 'node-extract'],
          ['node-extract', 'node-transform'],
          ['node-transform', 'boundary-end'],
        ]),
      );
    });
  });

  describe('when two parallel paths join', () => {
    it('keeps both paths with one connection into and out of each step', () => {
      const { edges } = constructNodesAndEdges({ stepGraph: parallelWorkflow.stepGraph });

      expect(edges).toHaveLength(7);
      expect(edges.map(edge => [edge.source, edge.target])).toEqual(
        expect.arrayContaining([
          ['boundary-start', 'node-start'],
          ['node-start', 'node-add-letter-b'],
          ['node-start', 'node-add-letter-c'],
          ['node-add-letter-b', 'node-mapping_join'],
          ['node-add-letter-c', 'node-mapping_join'],
          ['node-mapping_join', 'node-final'],
          ['node-final', 'boundary-end'],
        ]),
      );
    });
  });
});
