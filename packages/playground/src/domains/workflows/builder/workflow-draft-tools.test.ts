import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import { describe, expect, it } from 'vitest';

import { createWorkflowDraft } from './workflow-draft';
import type { WorkflowDraft } from './workflow-draft';
import { createWorkflowDraftTools, parseWorkflowDefinitionInput } from './workflow-draft-tools';

const canonicalFixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../test-fixtures/workflow-builder-canonical/definitions.json'), 'utf8'),
) as Array<{ name: string; input: unknown; expected: unknown }>;

const executeTool = async (tool: unknown, input: unknown) => {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Expected executable client tool');
  }
  return tool.execute(input, { toolCallId: 'test-call', messages: [] });
};

describe('workflow draft client tools', () => {
  describe('when a complete definition reaches the Studio adapter', () => {
    it.each(canonicalFixtures)(
      'normalizes the $name fixture identically to the shared contract',
      ({ input, expected }) => {
        expect(parseWorkflowDefinitionInput(input)).toEqual(expected);
        expect(parseWorkflowDefinitionInput(input)).toEqual(normalizeWorkflowBuilderDefinition(input));
      },
    );
  });

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
      await executeTool(tools['add-workflow-step'], {
        step: { type: 'agent', id: 'summarize-data', agent: 'summary-agent', input: { prompt: '{{input.prompt}}' } },
      });

      expect(draft.id).toBe('daily-report');
      expect(draft.graph).toEqual([
        { type: 'tool', id: 'fetch-data', toolId: 'report-data' },
        { type: 'agent', id: 'summarize-data', agentId: 'summary-agent' },
      ]);
    });

    it('normalizes object mapping configuration emitted by providers', async () => {
      let draft = createWorkflowDraft('test-workflow');
      const tools = createWorkflowDraftTools({
        getDraft: () => draft,
        setDraft: nextDraft => {
          draft = nextDraft;
        },
      });

      const result = await executeTool(tools['add-workflow-step'], {
        step: {
          type: 'mapping',
          id: 'test-output',
          mapConfig: { output: { ok: true } },
        },
      });

      expect(result).toEqual({ success: true });
      expect(draft.graph).toEqual([
        {
          type: 'mapping',
          id: 'test-output',
          mapConfig: JSON.stringify({ output: { ok: true } }),
        },
      ]);
    });
  });

  describe('when the assistant omits optional schemas with null values', () => {
    it('normalizes them to omitted draft schemas', async () => {
      let draft = createWorkflowDraft('daily-report');
      const tools = createWorkflowDraftTools({
        getDraft: () => draft,
        setDraft: nextDraft => {
          draft = nextDraft;
        },
      });

      const result = await executeTool(tools['set-workflow-schemas'], {
        inputSchema: {},
        outputSchema: {},
        stateSchema: null,
        requestContextSchema: null,
      });

      expect(result).toEqual({ success: true });
      expect(draft.stateSchema).toBeUndefined();
      expect(draft.requestContextSchema).toBeUndefined();
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
