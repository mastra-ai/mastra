import { describe, expect, it } from 'vitest';

import { isWorkflowToolVisibleInPhase } from './workflow-chat-tools';

describe('isWorkflowToolVisibleInPhase', () => {
  describe('when the generation phase changes', () => {
    it('exposes only the tools valid for the next model turn', () => {
      expect(isWorkflowToolVisibleInPhase('get-tool-schema', 'constructing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('add-workflow-step', 'constructing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('checkpoint-workflow-draft', 'constructing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('finalize-workflow-draft', 'constructing')).toBe(false);

      expect(isWorkflowToolVisibleInPhase('get-tool-schema', 'checkpointed')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('finalize-workflow-draft', 'checkpointed')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('add-workflow-step', 'checkpointed')).toBe(false);

      expect(isWorkflowToolVisibleInPhase('get-tool-schema', 'repairing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('set-workflow-mapping-source', 'repairing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('checkpoint-workflow-candidate', 'repairing')).toBe(true);
      expect(isWorkflowToolVisibleInPhase('finalize-workflow-draft', 'repairing')).toBe(false);

      expect(isWorkflowToolVisibleInPhase('get-tool-schema', 'finalized')).toBe(false);
      expect(isWorkflowToolVisibleInPhase('finalize-workflow-draft', 'finalized')).toBe(false);
    });
  });
});
