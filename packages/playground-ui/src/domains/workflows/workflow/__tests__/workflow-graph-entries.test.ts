// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';

const entryByType = {
  step: { type: 'step', step: { id: 'operation' } },
  agent: { type: 'agent', id: 'operation', agentId: 'support' },
  tool: { type: 'tool', id: 'operation', toolId: 'lookup' },
  classifier: { type: 'classifier', id: 'operation', classifierId: 'router' },
  mapping: { type: 'mapping', id: 'operation', mapConfig: 'inputData' },
  workflow: { type: 'workflow', id: 'operation', workflowId: 'child' },
  sleep: { type: 'sleep', id: 'operation', duration: 0 },
  sleepUntil: { type: 'sleepUntil', id: 'operation', date: new Date('2026-09-15T12:00:00Z') },
  foreach: { type: 'foreach', step: { type: 'step', step: { id: 'operation' } } },
  loop: {
    type: 'loop',
    step: { type: 'step', step: { id: 'operation' } },
    loopType: 'dowhile',
    serializedCondition: { id: 'continue', fn: 'inputData.continue' },
  },
  parallel: { type: 'parallel', steps: [{ type: 'step', step: { id: 'operation' } }] },
  conditional: {
    type: 'conditional',
    steps: [{ type: 'step', step: { id: 'operation' } }],
    serializedConditions: [{ id: 'eligible', fn: 'inputData.eligible' }],
  },
} satisfies { [Kind in SerializedStepFlowEntry['type']]: Extract<SerializedStepFlowEntry, { type: Kind }> };

describe('Workflow serialized entries', () => {
  describe.each(Object.values(entryByType))('when the graph contains $type', entry => {
    it('retains the operation and connects only existing nodes', () => {
      const { nodes, edges } = constructNodesAndEdges({ stepGraph: [entry] });
      const ids = new Set(nodes.map(node => node.id));
      expect(ids.has('node-operation')).toBe(true);
      expect(edges.length).toBeGreaterThan(0);
      for (const edge of edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    });
  });

  describe('when a branch has no matching serialized condition', () => {
    it('rejects an incomplete definition instead of drawing an unconditional path', () => {
      expect(() =>
        constructNodesAndEdges({
          stepGraph: [
            {
              type: 'conditional',
              steps: [{ type: 'step', step: { id: 'approval' } }],
              serializedConditions: [],
            },
          ],
        }),
      ).toThrow('A workflow branch is missing its condition.');
    });
  });
});
