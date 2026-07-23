import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflowConversationGeneration,
  getWorkflowBuilderThreadId,
  serializeWorkflowDraftInstructions,
} from './workflow-conversation';
import { createWorkflowDraftAuthoringState } from './workflow-draft';
import { createWorkflowDraftCandidate } from './workflow-draft-tools';

describe('workflow conversation', () => {
  describe('when identifying a persisted workflow conversation', () => {
    it('uses a stable workflow-prefixed thread id', () => {
      expect(getWorkflowBuilderThreadId('project-1', 'daily-report')).toBe('workflow-builder-project-1-daily-report');
    });
  });

  describe('when creating hidden instructions', () => {
    it('serializes the authoritative draft without adding a visible message', () => {
      const state = createWorkflowDraftAuthoringState('daily-report');
      const instructions = serializeWorkflowDraftInstructions(state, {
        agents: { 'support-agent': {} },
        workflowCatalog: 'unavailable',
      });

      expect(instructions).toContain('## Current unsaved workflow authoring state');
      expect(instructions).toContain('Lifecycle: untouched');
      expect(instructions).toContain('Revision: 0');
      expect(instructions).toContain('"workflowCatalog": "unavailable"');
      expect(instructions).toContain('support-agent');
      expect(instructions).toContain('"id": "daily-report"');
      expect(instructions).toContain('{ "initData": "prompt", "path": "" }');
      expect(instructions).toContain('After a successful checkpoint, Finalize immediately');
    });

    it('includes the repairable generation candidate separately from accepted state', () => {
      const state = createWorkflowDraftAuthoringState('daily-report');
      const candidate = createWorkflowDraftCandidate(state);
      candidate.revision = 2;
      candidate.hasUncheckpointedChanges = true;
      candidate.draft.description = 'Candidate-only description';

      const instructions = serializeWorkflowDraftInstructions(state, {}, candidate);

      expect(instructions).toContain('## Generation-local candidate');
      expect(instructions).toContain('Candidate revision: 2');
      expect(instructions).toContain('Candidate-only description');
      expect(state.draft.description).toBeUndefined();
    });
  });

  describe('when a newer submission supersedes an active stream', () => {
    it('aborts the previous generation and rejects its late events', () => {
      const firstAbort = vi.fn();
      const secondAbort = vi.fn();
      const conversation = createWorkflowConversationGeneration();

      const first = conversation.start(firstAbort);
      const second = conversation.start(secondAbort);

      expect(firstAbort).toHaveBeenCalledOnce();
      expect(first.isCurrent()).toBe(false);
      expect(second.isCurrent()).toBe(true);
      second.cancel();
      expect(secondAbort).toHaveBeenCalledOnce();
      expect(second.isCurrent()).toBe(false);
    });
  });
});
