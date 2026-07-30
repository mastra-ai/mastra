import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import {
  getOriginalWorkflowRequest,
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
      const instructions = serializeWorkflowDraftInstructions(state);

      expect(instructions).toContain('## Current unsaved workflow authoring state');
      expect(instructions).toContain('Lifecycle: untouched');
      expect(instructions).toContain('Revision: 0');
      expect(instructions).toContain('"id": "daily-report"');
      expect(instructions).toContain('{ "initData": true, "path": "prompt" }');
      expect(instructions).toContain('submit-workflow-draft');
      expect(instructions).toContain('correct the complete definition');
    });

    it('retains the original request while repairing a persisted conversation', () => {
      const messages = [
        {
          id: 'original-request',
          role: 'user',
          createdAt: new Date('2026-07-27T12:00:00.000Z'),
          content: { format: 2, parts: [{ type: 'text', text: 'Build the mixed support pipeline' }] },
        },
      ] satisfies MastraDBMessage[];
      const originalRequest = getOriginalWorkflowRequest(messages);
      const instructions = serializeWorkflowDraftInstructions(
        createWorkflowDraftAuthoringState('mixed-support-pipeline'),
        undefined,
        originalRequest,
      );

      expect(instructions).toContain('## Original workflow request');
      expect(instructions).toContain('Build the mixed support pipeline');
      expect(instructions).toContain('Do not ask the user to restate it.');
    });

    it('includes the repairable generation candidate separately from accepted state', () => {
      const state = createWorkflowDraftAuthoringState('daily-report');
      const candidate = createWorkflowDraftCandidate(state);
      candidate.revision = 2;
      candidate.hasUncheckpointedChanges = true;
      candidate.draft.description = 'Candidate-only description';

      const instructions = serializeWorkflowDraftInstructions(state, candidate);

      expect(instructions).toContain('## Generation-local candidate');
      expect(instructions).toContain('Candidate revision: 2');
      expect(instructions).toContain('Candidate-only description');
      expect(state.draft.description).toBeUndefined();
    });
  });
});
