// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';
import { getWorkflowGraphGroups, getWorkflowMapContext } from '../workflow-graph-groups';
import { WORKFLOW_STEP_NODE_TYPE } from '../workflow-step-node-utils';
import { branchWorkflow, parallelWorkflow } from './fixtures/workflow-debug-step-controls';

describe('Workflow graph groups', () => {
  describe('when parallel steps feed a map', () => {
    it('groups the concurrent steps and identifies the map as transforming their results', () => {
      const { nodes, edges } = constructNodesAndEdges(parallelWorkflow);
      expect(getWorkflowGraphGroups(nodes)).toEqual([
        expect.objectContaining({
          label: 'Parallel',
          description: '2 paths · Run together',
          nodeIds: ['node-add-letter-b', 'node-add-letter-c'],
        }),
      ]);
      const map = nodes.find(node => node.id === 'node-mapping_join');
      expect(map?.type).toBe(WORKFLOW_STEP_NODE_TYPE);
      if (map?.type !== WORKFLOW_STEP_NODE_TYPE) throw new Error('Expected map node');
      expect(getWorkflowMapContext(map, nodes, edges)).toEqual({
        label: 'Map parallel results',
        description: 'Transform the outputs after all parallel paths finish.',
      });
    });
  });
  describe('when a parallel path is itself parallel', () => {
    it('brackets every concurrent step of the outer path', () => {
      const { nodes } = constructNodesAndEdges({
        stepGraph: [
          {
            type: 'parallel',
            steps: [
              {
                type: 'parallel',
                steps: [
                  { type: 'step', step: { id: 'fetch' } },
                  { type: 'step', step: { id: 'scan' } },
                ],
              },
              { type: 'step', step: { id: 'notify' } },
            ],
          },
        ],
      });

      expect(getWorkflowGraphGroups(nodes)).toEqual([
        expect.objectContaining({ nodeIds: ['node-fetch', 'node-scan', 'node-notify'] }),
      ]);
    });
  });
  describe('when conditional branches feed a map', () => {
    it('does not describe conditional paths as parallel execution', () => {
      const { nodes, edges } = constructNodesAndEdges(branchWorkflow);
      expect(getWorkflowGraphGroups(nodes)).toEqual([]);
      const map = nodes.find(node => node.id === 'node-mapping_join');
      if (map?.type !== WORKFLOW_STEP_NODE_TYPE) throw new Error('Expected map node');
      expect(getWorkflowMapContext(map, nodes, edges)).toEqual({
        label: 'Map branch results',
        description: 'Transform the outputs of the matching branches.',
      });
    });
  });
  describe('when a developer names a map', () => {
    it('retains that name instead of replacing it with a generic title', () => {
      const { nodes, edges } = constructNodesAndEdges({
        stepGraph: [{ type: 'step', step: { id: 'normalize-address', mapConfig: 'inputData' } }],
      });
      const map = nodes.find(node => node.id === 'node-normalize-address');
      if (map?.type !== WORKFLOW_STEP_NODE_TYPE) throw new Error('Expected map node');
      expect(getWorkflowMapContext(map, nodes, edges)?.label).toBe('normalize-address');
    });
  });
});
