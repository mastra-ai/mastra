import { describe, expect, it } from 'vitest';

import { createWorkflowDraft } from './workflow-draft';
import type { WorkflowDraft } from './workflow-draft';
import { createWorkflowDraftTools } from './workflow-draft-tools';

const executeTool = async (tool: unknown, input: unknown) => {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Expected executable client tool');
  }
  return tool.execute(input, { toolCallId: 'test-call', messages: [] });
};

describe('workflow draft client tools', () => {
  describe('when the assistant invokes constrained workflow mutations', () => {
    it('mutates the authoritative draft through typed operations', async () => {
      let draft = createWorkflowDraft('new-workflow');
      const tools = createWorkflowDraftTools({
        getDraft: () => draft,
        setDraft: nextDraft => {
          draft = nextDraft;
        },
      });

      await executeTool(tools['set-workflow-identity'], {
        id: 'daily-report',
        description: 'Builds the daily report',
      });
      await executeTool(tools['add-workflow-step'], {
        step: { type: 'tool', id: 'fetch-data', toolId: 'report-data' },
      });

      expect(draft.id).toBe('daily-report');
      expect(draft.graph).toEqual([{ type: 'tool', id: 'fetch-data', toolId: 'report-data' }]);
    });
  });

  describe('when the assistant proposes an invalid mutation', () => {
    it('returns a repairable error and leaves the draft unchanged', async () => {
      let draft: WorkflowDraft = {
        ...createWorkflowDraft('daily-report'),
        graph: [{ type: 'tool', id: 'fetch-data', toolId: 'report-data' }],
      };
      const initial = draft;
      const tools = createWorkflowDraftTools({
        getDraft: () => draft,
        setDraft: nextDraft => {
          draft = nextDraft;
        },
      });

      const result = await executeTool(tools['add-workflow-step'], {
        step: { type: 'tool', id: 'fetch-data', toolId: 'other-tool' },
      });

      expect(result).toEqual({ success: false, error: 'Step id "fetch-data" is duplicated.' });
      expect(draft).toEqual(initial);
    });
  });

  describe('when a previous submission is superseded', () => {
    it('rejects its late tool result without mutating the current draft', async () => {
      let draft = createWorkflowDraft('daily-report');
      let isCurrent = true;
      const tools = createWorkflowDraftTools({
        getDraft: () => draft,
        setDraft: nextDraft => {
          draft = nextDraft;
        },
        isCurrentGeneration: () => isCurrent,
      });
      isCurrent = false;

      const result = await executeTool(tools['add-workflow-step'], {
        step: { type: 'tool', id: 'fetch-data', toolId: 'report-data' },
      });

      expect(result).toEqual({ success: false, error: 'This workflow-builder submission was superseded.' });
      expect(draft.graph).toEqual([]);
    });
  });
});
