import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkflowDefinitionGraphView } from './workflow-definition-graph-view';
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
    { type: 'foreach', step: { id: 'review', type: 'agent', agentId: 'reviewer' } },
    { id: 'pause', type: 'sleep', duration: 1000 },
    { id: 'wait-until', type: 'sleepUntil', date: '2030-01-01T00:00:00.000Z' },
  ],
};

describe('WorkflowDefinitionGraphView', () => {
  describe('when a persisted workflow definition is displayed', () => {
    it('renders every supported step and its nested grouping', () => {
      render(<WorkflowDefinitionGraphView draft={draft} />);

      expect(screen.getByText('classify')).toBeTruthy();
      expect(screen.getByText('lookup')).toBeTruthy();
      expect(screen.getByText('reshape')).toBeTruthy();
      expect(screen.getByText('Parallel')).toBeTruthy();
      expect(screen.getByText('notify')).toBeTruthy();
      expect(screen.getByText('For each')).toBeTruthy();
      expect(screen.getByText('review')).toBeTruthy();
      expect(screen.getByText('pause')).toBeTruthy();
      expect(screen.getByText('wait-until')).toBeTruthy();
    });
  });
});
