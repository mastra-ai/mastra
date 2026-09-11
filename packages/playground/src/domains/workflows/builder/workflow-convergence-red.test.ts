import { describe, expect, it } from 'vitest';

import { checkpointWorkflowDraft, createWorkflowDraftAuthoringState, finalizeWorkflowDraft } from './workflow-draft';
import { createWorkflowDraftCandidate, createWorkflowDraftTools } from './workflow-draft-tools';

function createTools() {
  let state = createWorkflowDraftAuthoringState('workflow-convergence-red');
  return createWorkflowDraftTools({
    getState: () => state,
    checkpoint: (expectedRevision, draft) => {
      const result = checkpointWorkflowDraft(state, expectedRevision, draft);
      if (result.ok) state = result.state;
      return result;
    },
    finalize: expectedRevision => {
      const result = finalizeWorkflowDraft(state, expectedRevision);
      if (result.ok) state = result.state;
      return result;
    },
    candidate: createWorkflowDraftCandidate(state),
  });
}

describe('Workflow Studio complex prompt authoring tools', () => {
  describe.each(['customer ticket workflow', 'parallel lookup workflow', 'priority router', 'mixed support pipeline'])(
    'when the %s needs validation-driven correction',
    () => {
      it('uses eager catalog listings and complete-definition resubmission without granular repair tools', () => {
        const tools = createTools();

        expect(Object.keys(tools)).toEqual([
          'list-available-agents',
          'list-available-tools',
          'list-available-workflows',
          'submit-workflow-draft',
        ]);
      });
    },
  );
});
