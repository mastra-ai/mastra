import { describe, expect, it } from 'vitest';

import { createWorkflowDefinitionGraph } from './workflow-definition-graph';
import type { WorkflowDraft } from './workflow-draft';

const draft: WorkflowDraft = {
  id: 'support-triage',
  inputSchema: { type: 'object', properties: {} },
  outputSchema: { type: 'object', properties: {} },
  graph: [
    { id: 'classify', type: 'agent', agentId: 'classifier' },
    { id: 'lookup', type: 'tool', toolId: 'customer-lookup' },
    { id: 'reshape', type: 'mapping', mapConfig: '{"prompt":"$.summary"}' },
    {
      type: 'parallel',
      steps: [
        { id: 'notify', type: 'tool', toolId: 'notify-team' },
        { id: 'draft', type: 'agent', agentId: 'response-writer' },
      ],
    },
    {
      type: 'foreach',
      step: { id: 'review', type: 'agent', agentId: 'reviewer' },
      opts: { concurrency: 2 },
    },
    { id: 'pause', type: 'sleep', duration: 1000 },
    { id: 'wait-until', type: 'sleepUntil', date: '2030-01-01T00:00:00.000Z' },
  ],
};

describe('createWorkflowDefinitionGraph', () => {
  describe('when a definition contains every supported persisted step shape', () => {
    it('creates readable nodes for top-level and nested steps', () => {
      const graph = createWorkflowDefinitionGraph(draft);

      expect(graph.nodes.map(node => [node.id, node.type, node.parentId])).toEqual([
        ['classify', 'agent', undefined],
        ['lookup', 'tool', undefined],
        ['reshape', 'mapping', undefined],
        ['parallel-3', 'parallel', undefined],
        ['parallel-3/notify', 'tool', 'parallel-3'],
        ['parallel-3/draft', 'agent', 'parallel-3'],
        ['foreach-4', 'foreach', undefined],
        ['foreach-4/review', 'agent', 'foreach-4'],
        ['pause', 'sleep', undefined],
        ['wait-until', 'sleepUntil', undefined],
      ]);
    });

    it('connects top-level sequence and nested group relationships', () => {
      const graph = createWorkflowDefinitionGraph(draft);

      expect(graph.edges).toContainEqual({ source: 'classify', target: 'lookup', kind: 'sequence' });
      expect(graph.edges).toContainEqual({ source: 'parallel-3', target: 'parallel-3/notify', kind: 'branch' });
      expect(graph.edges).toContainEqual({ source: 'foreach-4', target: 'foreach-4/review', kind: 'iteration' });
    });
  });
});
