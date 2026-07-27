import { describe, expect, it } from 'vitest';

import {
  checkpointWorkflowDraft,
  createWorkflowDraftAuthoringState,
  finalizeWorkflowDraft,
  mutateWorkflowDraftAuthoringState,
} from './workflow-draft';
import { createWorkflowDraftCandidate, createWorkflowDraftTools } from './workflow-draft-tools';

function createTools() {
  let state = createWorkflowDraftAuthoringState('workflow-convergence-red');
  return createWorkflowDraftTools({
    getState: () => state,
    checkpoint: (expectedRevision, draft) => {
      const result = checkpointWorkflowDraft(state, expectedRevision, draft);
      state = result.state;
      return result;
    },
    finalize: expectedRevision => {
      const result = finalizeWorkflowDraft(state, expectedRevision);
      state = result.state;
      return result;
    },
    candidate: createWorkflowDraftCandidate(state),
    mutateCandidate: (candidateState, expectedRevision, mutation) =>
      mutateWorkflowDraftAuthoringState(candidateState, expectedRevision, mutation),
  });
}

describe('Workflow Studio complex prompt repair tools', () => {
  describe('when the customer ticket workflow needs an unambiguous source repair', () => {
    it('exposes schema inspection and typed mapping-source operations', () => {
      const tools = createTools();

      expect(tools).toHaveProperty('get-tool-schema');
      expect(tools).toHaveProperty('explain-validation-issue');
      expect(tools).toHaveProperty('set-workflow-mapping-source');
    });
  });

  describe('when the parallel lookup workflow needs input shaping and child aggregation', () => {
    it('exposes compatible-source inspection and before/after mapping insertion', () => {
      const tools = createTools();

      expect(tools).toHaveProperty('list-compatible-sources');
      expect(tools).toHaveProperty('insert-workflow-mapping-before');
      expect(tools).toHaveProperty('insert-workflow-mapping-after');
    });
  });

  describe('when the priority router has invalid predicate roots', () => {
    it('exposes a structured predicate repair operation', () => {
      const tools = createTools();

      expect(tools).toHaveProperty('get-agent-schema');
      expect(tools).toHaveProperty('set-workflow-predicate');
    });
  });

  describe('when the mixed pipeline changes diagnostics during repair', () => {
    it('exposes workflow inspection and targeted mapping operations without replacing the definition', () => {
      const tools = createTools();

      expect(tools).toHaveProperty('get-workflow-schema');
      expect(tools).toHaveProperty('set-workflow-mapping-source');
      expect(tools).not.toHaveProperty('replace-workflow-definition');
    });
  });
});
