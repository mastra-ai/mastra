import { describe, expect, it, vi } from 'vitest';

import {
  createWorkflowConversationGeneration,
  getWorkflowBuilderThreadId,
  serializeWorkflowDraftInstructions,
} from './workflow-conversation';
import { createWorkflowDraft } from './workflow-draft';

describe('workflow conversation', () => {
  describe('when identifying a persisted workflow conversation', () => {
    it('uses a stable workflow-prefixed thread id', () => {
      expect(getWorkflowBuilderThreadId('project-1', 'daily-report')).toBe('workflow-builder-project-1-daily-report');
    });
  });

  describe('when creating hidden instructions', () => {
    it('serializes the authoritative draft without adding a visible message', () => {
      const draft = createWorkflowDraft('daily-report');

      expect(serializeWorkflowDraftInstructions(draft)).toContain(
        '## Current persisted workflow definition\n```json\n',
      );
      expect(serializeWorkflowDraftInstructions(draft)).toContain('"id": "daily-report"');
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
