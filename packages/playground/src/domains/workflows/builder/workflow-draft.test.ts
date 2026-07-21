import type { UpsertStoredWorkflowParams } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { applyWorkflowDraftMutation, createWorkflowDraft, validateWorkflowDraft } from './workflow-draft';
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
});
