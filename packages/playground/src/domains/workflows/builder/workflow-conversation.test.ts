import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflowConversationGeneration,
  getWorkflowBuilderThreadId,
  serializeWorkflowDraftInstructions,
} from './workflow-conversation';
import { createWorkflowDraftAuthoringState } from './workflow-draft';

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
