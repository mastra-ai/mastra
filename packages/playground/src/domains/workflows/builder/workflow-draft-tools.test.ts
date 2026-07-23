import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import { describe, expect, it } from 'vitest';

import {
  checkpointWorkflowDraft,
  createWorkflowDraftAuthoringState,
  finalizeWorkflowDraft,
  mutateWorkflowDraftAuthoringState,
} from './workflow-draft';
import type { WorkflowDraftAuthoringState } from './workflow-draft';
import { createWorkflowDraftTools, parseWorkflowDefinitionInput } from './workflow-draft-tools';
import type { WorkflowDraftToolResult } from './workflow-draft-tools';

const canonicalFixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../test-fixtures/workflow-builder-canonical/definitions.json'), 'utf8'),
) as Array<{ name: string; input: unknown; expected: unknown }>;

const executeTool = async (tool: unknown, input: unknown) => {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Expected executable client tool');
  }
  return tool.execute(input, { toolCallId: 'test-call', messages: [] });
};

function createStore(
  id = 'new-workflow',
  isCurrentGeneration?: () => boolean,
  onResult?: (event: WorkflowDraftToolResult) => void,
) {
  let state = createWorkflowDraftAuthoringState(id);
  const apply = (result: ReturnType<typeof checkpointWorkflowDraft>) => {
    state = result.state;
    return result;
  };
  return {
    get state(): WorkflowDraftAuthoringState {
      return state;
    },
    tools: createWorkflowDraftTools({
      getState: () => state,
      checkpoint: (expectedRevision, draft) => apply(checkpointWorkflowDraft(state, expectedRevision, draft)),
      finalize: expectedRevision => apply(finalizeWorkflowDraft(state, expectedRevision)),
      mutate: (expectedRevision, mutation) =>
        apply(mutateWorkflowDraftAuthoringState(state, expectedRevision, mutation)),
      isCurrentGeneration,
      onResult,
    }),
  };
}

const completeDefinition = {
  id: 'daily-report',
  description: 'Builds the daily report',
  inputSchema: { type: 'object', properties: {} },
  outputSchema: { type: 'object', properties: {} },
  graph: [{ type: 'tool' as const, id: 'fetch-data', toolId: 'report-data' }],
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

  describe('when the browser registers workflow authoring tools', () => {
    it('exposes checkpoint, finalize, and targeted edits without setters or server save', () => {
      const { tools } = createStore();

      expect(Object.keys(tools)).toEqual([
        'checkpoint-workflow-draft',
        'finalize-workflow-draft',
        'add-workflow-step',
        'update-workflow-step',
        'remove-workflow-step',
      ]);
    });
  });

  describe('when a draft tool returns structured repair feedback', () => {
    it('reports the tool id and result to the generation controller', async () => {
      const results: WorkflowDraftToolResult[] = [];
      const { tools } = createStore('new-workflow', undefined, event => results.push(event));

      await executeTool(tools['checkpoint-workflow-draft'], {
        id: 'new-workflow',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        graph: [
          { type: 'tool', id: 'duplicate', toolId: 'report-data' },
          { type: 'tool', id: 'duplicate', toolId: 'report-data' },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.toolId).toBe('checkpoint-workflow-draft');
      expect(results[0]?.result.success).toBe(false);
    });
  });

  describe('when the assistant checkpoints a complete definition', () => {
    it('atomically renders the canonical definition as a constructing revision', async () => {
      const store = createStore();

      const result = await executeTool(store.tools['checkpoint-workflow-draft'], completeDefinition);

      expect(result).toEqual({ success: true, lifecycle: 'constructing', revision: 1, finalizedRevision: undefined });
      expect(store.state.draft).toEqual(completeDefinition);
    });
  });

  describe('when the assistant finalizes the accepted revision', () => {
    it('marks that exact unsaved revision ready', async () => {
      const store = createStore();
      await executeTool(store.tools['checkpoint-workflow-draft'], completeDefinition);

      const result = await executeTool(store.tools['finalize-workflow-draft'], { expectedRevision: 1 });

      expect(result).toEqual({ success: true, lifecycle: 'ready', revision: 1, finalizedRevision: 1 });
      expect(store.state.lifecycle).toBe('ready');
    });
  });

  describe('when strict finalization rejects an incompatible workflow', () => {
    it('returns structured issue codes and paths for bounded repair', async () => {
      const store = createStore();
      await executeTool(store.tools['checkpoint-workflow-draft'], {
        ...completeDefinition,
        graph: [
          {
            type: 'foreach',
            step: { type: 'agent', id: 'summarize-item', agentId: 'summary-agent' },
          },
        ],
      });

      const result = await executeTool(store.tools['finalize-workflow-draft'], { expectedRevision: 1 });

      expect(result).toMatchObject({
        success: false,
        issues: [
          {
            code: 'incompatible-schema',
            path: 'graph.0',
          },
        ],
      });
    });
  });

  describe('when the assistant targets a stale revision', () => {
    it('returns the deterministic revision conflict without changing the draft', async () => {
      const store = createStore();
      await executeTool(store.tools['checkpoint-workflow-draft'], completeDefinition);

      const result = await executeTool(store.tools['finalize-workflow-draft'], { expectedRevision: 0 });

      expect(result).toEqual({ success: false, error: 'Draft changed before this operation completed.' });
      expect(store.state.lifecycle).toBe('constructing');
    });
  });

  describe('when the assistant edits a ready draft', () => {
    it('demotes it to constructing and returns the new revision', async () => {
      const store = createStore();
      await executeTool(store.tools['checkpoint-workflow-draft'], completeDefinition);
      await executeTool(store.tools['finalize-workflow-draft'], { expectedRevision: 1 });

      const result = await executeTool(store.tools['add-workflow-step'], {
        step: { type: 'agent', id: 'summarize-data', agent: 'summary-agent' },
      });

      expect(result).toEqual({ success: true, lifecycle: 'constructing', revision: 2, finalizedRevision: undefined });
      expect(store.state.draft.graph[1]).toEqual({
        type: 'agent',
        id: 'summarize-data',
        agentId: 'summary-agent',
      });
    });
  });

  describe('when a targeted edit contains nested provider aliases', () => {
    it.each([
      { type: 'foreach', step: { type: 'agent', id: 'foreach-agent', agent: 'summary-agent' } },
      {
        type: 'conditional',
        steps: [{ type: 'agent', id: 'conditional-agent', agent: 'summary-agent' }],
        predicates: [{ op: 'exists', path: 'inputData.value' }],
      },
      {
        type: 'loop',
        step: { type: 'agent', id: 'loop-agent', agent: 'summary-agent' },
        loopType: 'dowhile',
        predicate: { op: 'truthy', value: { path: 'inputData.continue' } },
      },
    ])('normalizes aliases recursively for $type entries', async step => {
      const store = createStore();

      const result = await executeTool(store.tools['add-workflow-step'], { step });

      expect(result).toMatchObject({ success: true, revision: 1 });
    });
  });

  describe('when a previous submission is superseded', () => {
    it('rejects its tool result without mutating the current draft', async () => {
      let isCurrent = false;
      const store = createStore('daily-report', () => isCurrent);

      const result = await executeTool(store.tools['checkpoint-workflow-draft'], completeDefinition);

      expect(result).toEqual({ success: false, error: 'Submission was superseded.' });
      expect(store.state.revision).toBe(0);
      isCurrent = true;
    });
  });
});
