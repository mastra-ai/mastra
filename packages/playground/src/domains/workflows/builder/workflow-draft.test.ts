import type { UpsertStoredWorkflowParams } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  applyWorkflowDraftMutation,
  checkpointWorkflowDraft,
  createLoadedWorkflowDraftAuthoringState,
  createWorkflowDraft,
  createWorkflowDraftAuthoringState,
  finalizeWorkflowDraft,
  mutateWorkflowDraftAuthoringState,
  reserveWorkflowDraftSave,
  validateWorkflowDraft,
} from './workflow-draft';
import type { WorkflowDraftMutation } from './workflow-draft';

const objectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const createValidDraft = (): UpsertStoredWorkflowParams => ({
  id: 'support-triage',
  description: 'Triages support requests',
  inputSchema: objectSchema,
  outputSchema: objectSchema,
  graph: [
    { type: 'agent', id: 'classify', agentId: 'classifier', outputSchema: objectSchema },
    { type: 'tool', id: 'lookup', toolId: 'customer-lookup' },
    { type: 'mapping', id: 'shape-output', mapConfig: '{"result":{"value":{"path":"lookup.result"}}}' },
    {
      type: 'parallel',
      steps: [
        { type: 'agent', id: 'summarize', agentId: 'summarizer', outputSchema: objectSchema },
        { type: 'tool', id: 'notify', toolId: 'notification-tool' },
      ],
    },
    {
      type: 'foreach',
      step: { type: 'tool', id: 'enrich-item', toolId: 'enrichment-tool' },
      opts: { concurrency: 2 },
    },
    { type: 'sleep', id: 'wait', duration: 1000 },
    { type: 'sleepUntil', id: 'wait-until', date: '2030-01-01T00:00:00.000Z' },
  ],
});

describe('workflow draft', () => {
  describe('when a draft contains every supported static entry type', () => {
    it('accepts the definition', () => {
      expect(validateWorkflowDraft(createValidDraft())).toEqual({ ok: true });
    });
  });

  describe('when a draft contains invalid or unsupported graph content', () => {
    it('returns repairable validation issues', () => {
      const draft = createValidDraft();
      draft.graph = [
        { type: 'agent', id: 'duplicate', agentId: 'classifier', outputSchema: objectSchema },
        { type: 'tool', id: 'duplicate', toolId: '' },
        { type: 'mapping', id: 'bad-map', mapConfig: 'not-json' },
      ];

      const result = validateWorkflowDraft(draft);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.map(issue => issue.code)).toEqual(
        expect.arrayContaining(['duplicate-step-id', 'missing-reference', 'invalid-map-config']),
      );
    });
  });

  describe('when constrained mutations are applied', () => {
    it('updates identity and graph entries without replacing the whole draft', () => {
      const initial = createWorkflowDraft('new-workflow');
      const mutations: WorkflowDraftMutation[] = [
        { type: 'set-identity', id: 'daily-report', description: 'Builds a daily report' },
        {
          type: 'add-step',
          index: 0,
          step: { type: 'tool', id: 'fetch-report-data', toolId: 'report-data' },
        },
        {
          type: 'update-step',
          stepId: 'fetch-report-data',
          step: { type: 'tool', id: 'fetch-report-data', toolId: 'report-data-v2' },
        },
      ];

      const result = mutations.reduce((draft, mutation) => applyWorkflowDraftMutation(draft, mutation).draft, initial);

      expect(result.id).toBe('daily-report');
      expect(result.description).toBe('Builds a daily report');
      expect(result.graph).toEqual([{ type: 'tool', id: 'fetch-report-data', toolId: 'report-data-v2' }]);
    });
  });

  describe('when a mutation would create an invalid graph', () => {
    it('rejects it and preserves the previous draft', () => {
      const initial = createValidDraft();
      const result = applyWorkflowDraftMutation(initial, {
        type: 'add-step',
        step: { type: 'tool', id: 'lookup', toolId: 'duplicate-id-tool' },
      });

      expect(result.ok).toBe(false);
      expect(result.draft).toEqual(initial);
    });
  });

  describe('when catalog schemas prove adjacent steps are incompatible', () => {
    it('requires a mapping step', () => {
      const draft = createValidDraft();
      draft.graph = [
        { type: 'tool', id: 'lookup', toolId: 'customer-lookup' },
        { type: 'agent', id: 'summarize', agentId: 'summarizer', outputSchema: objectSchema },
      ];

      const result = validateWorkflowDraft(draft, {
        tools: {
          'customer-lookup': {
            outputSchema: { type: 'object', properties: { customer: { type: 'string' } }, required: ['customer'] },
          },
        },
        agents: { summarizer: {} },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'incompatible-schema', path: 'graph.1' })]),
      );
    });
  });

  describe('when catalog schemas are unavailable or inconclusive', () => {
    it('does not reject an otherwise valid draft', () => {
      expect(validateWorkflowDraft(createValidDraft())).toEqual({ ok: true });
    });
  });

  describe('when a mutation targets a missing step', () => {
    it('returns a repairable mutation error', () => {
      const initial = createValidDraft();
      const result = applyWorkflowDraftMutation(initial, { type: 'remove-step', stepId: 'missing' });

      expect(result).toEqual({
        ok: false,
        draft: initial,
        issues: [{ code: 'invalid-mutation', path: 'stepId', message: 'Step "missing" does not exist.' }],
      });
    });
  });

  describe('when a new authoring draft is initialized', () => {
    it('starts untouched without presenting strict validation issues', () => {
      expect(createWorkflowDraftAuthoringState('new-workflow')).toMatchObject({
        lifecycle: 'untouched',
        revision: 0,
        checkpointIssues: [],
        finalIssues: [],
      });
    });
  });

  describe('when a structurally safe incomplete checkpoint is accepted', () => {
    it('increments the revision and keeps the draft constructing', () => {
      const initial = createWorkflowDraftAuthoringState('new-workflow');
      const result = checkpointWorkflowDraft(initial, 0, createWorkflowDraft('new-workflow'));

      expect(result).toMatchObject({ ok: true, state: { lifecycle: 'constructing', revision: 1 } });
    });
  });

  describe('when a malformed checkpoint is submitted', () => {
    it('preserves the previously accepted snapshot', () => {
      const initial = createWorkflowDraftAuthoringState('new-workflow');
      const malformed = createWorkflowDraft('new-workflow');
      malformed.graph = [{ type: 'mapping', id: 'bad-map', mapConfig: 'not-json' }];

      const result = checkpointWorkflowDraft(initial, 0, malformed);

      expect(result).toMatchObject({ ok: false, state: initial });
    });
  });

  describe('when the current revision is finalized', () => {
    it('marks that exact revision ready without persisting', () => {
      const initial = createWorkflowDraftAuthoringState('new-workflow');
      const checkpoint = checkpointWorkflowDraft(initial, 0, createValidDraft());
      if (!checkpoint.ok) throw new Error(checkpoint.error);

      const result = finalizeWorkflowDraft(checkpoint.state, 1);

      expect(result).toMatchObject({
        ok: true,
        state: { lifecycle: 'ready', revision: 1, finalizedRevision: 1 },
      });
    });
  });

  describe('when a ready draft is edited', () => {
    it('demotes the new revision to constructing', () => {
      const ready = createLoadedWorkflowDraftAuthoringState(createValidDraft());

      const result = mutateWorkflowDraftAuthoringState(ready, 0, {
        type: 'set-identity',
        id: 'support-triage-v2',
        description: 'Updated',
      });

      expect(result).toMatchObject({ ok: true, state: { lifecycle: 'constructing', revision: 1 } });
      expect(result.state.finalizedRevision).toBeUndefined();
    });
  });

  describe('when an operation targets a stale revision', () => {
    it('rejects without mutating the current state', () => {
      const ready = createLoadedWorkflowDraftAuthoringState(createValidDraft());

      expect(finalizeWorkflowDraft(ready, 1)).toEqual({
        ok: false,
        state: ready,
        error: 'Draft changed before this operation completed.',
      });
    });
  });

  describe('when a ready revision is reserved for saving', () => {
    it('blocks later mutations until the reservation is released', () => {
      const ready = createLoadedWorkflowDraftAuthoringState(createValidDraft());
      const reserved = reserveWorkflowDraftSave(ready, 0);
      if (!reserved.ok) throw new Error(reserved.error);

      expect(
        mutateWorkflowDraftAuthoringState(reserved.state, 0, {
          type: 'set-identity',
          id: 'changed',
        }),
      ).toMatchObject({ ok: false, error: 'Workflow save is in progress.' });
    });
  });

  describe('when the workflow catalog is unavailable', () => {
    it('accepts a nested workflow checkpoint but blocks finalization', () => {
      const initial = createWorkflowDraftAuthoringState('nested-flow');
      const nested = createWorkflowDraft('nested-flow');
      nested.graph = [{ type: 'workflow', id: 'child', workflowId: 'child-flow' }];
      const checkpoint = checkpointWorkflowDraft(initial, 0, nested, { workflowCatalog: 'unavailable' });
      if (!checkpoint.ok) throw new Error(checkpoint.error);

      expect(finalizeWorkflowDraft(checkpoint.state, 1, { workflowCatalog: 'unavailable' })).toMatchObject({
        ok: false,
        state: { lifecycle: 'constructing' },
        issues: [expect.objectContaining({ code: 'workflow-catalog-unavailable' })],
      });
    });
  });
});
