import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import { describe, expect, it } from 'vitest';

import { checkpointWorkflowDraft, createWorkflowDraftAuthoringState, finalizeWorkflowDraft } from './workflow-draft';
import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import {
  createWorkflowDraftCandidate,
  createWorkflowDraftTools,
  parseWorkflowDefinitionInput,
} from './workflow-draft-tools';
import type { WorkflowDraftCandidate, WorkflowDraftToolResult } from './workflow-draft-tools';

const canonicalFixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../test-fixtures/workflow-builder-canonical/definitions.json'), 'utf8'),
) as Array<{ name: string; input: unknown; expected: unknown }>;

const executeTool = async (tool: unknown, input: unknown) => {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Expected executable client tool');
  }
  return tool.execute(input, { toolCallId: 'test-call', messages: [] });
};

const validationContext: WorkflowDraftValidationContext = {
  agents: { supportAgent: { runtimeId: 'support-agent' } },
  tools: {
    lookupCustomer: {
      runtimeId: 'lookup-customer',
      inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      outputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
    },
  },
  workflows: {
    greetingWorkflow: {
      runtimeId: 'greeting-workflow',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } } },
    },
  },
  workflowCatalog: 'available',
};

function createStore(options?: {
  candidate?: WorkflowDraftCandidate;
  isCurrentGeneration?: () => boolean;
  onResult?: (event: WorkflowDraftToolResult) => void;
  onCandidateChange?: (candidate: WorkflowDraftCandidate) => void;
  context?: WorkflowDraftValidationContext;
}) {
  let state = createWorkflowDraftAuthoringState('new-workflow');
  const apply = (result: ReturnType<typeof checkpointWorkflowDraft>) => {
    if (result.ok) state = result.state;
    return result;
  };
  return {
    get state(): WorkflowDraftAuthoringState {
      return state;
    },
    tools: createWorkflowDraftTools({
      getState: () => state,
      checkpoint: (expectedRevision, draft) =>
        apply(checkpointWorkflowDraft(state, expectedRevision, draft, options?.context)),
      finalize: expectedRevision => apply(finalizeWorkflowDraft(state, expectedRevision, options?.context)),
      candidate: options?.candidate,
      validationContext: options?.context,
      isCurrentGeneration: options?.isCurrentGeneration,
      onResult: options?.onResult,
      onCandidateChange: options?.onCandidateChange,
    }),
  };
}

const validDefinition = {
  id: 'new-workflow',
  inputSchema: {
    type: 'object',
    properties: { email: { type: 'string' } },
    required: ['email'],
    additionalProperties: false,
  },
  outputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
  graph: [{ type: 'tool' as const, id: 'lookup', toolId: 'lookupCustomer' }],
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
    it('exposes only unified resource inspection and whole-definition submission', () => {
      expect(Object.keys(createStore().tools)).toEqual(['inspect-workflow-resources', 'submit-workflow-draft']);
    });
  });

  describe('when registered resources are inspected', () => {
    it('returns authoritative identities and schemas for multiple resource types', async () => {
      const { tools } = createStore({ context: validationContext });
      const result = await executeTool(tools['inspect-workflow-resources'], {
        resources: [
          { type: 'tool', registryKey: 'lookupCustomer' },
          { type: 'agent', registryKey: 'supportAgent' },
          { type: 'workflow', registryKey: 'greetingWorkflow' },
        ],
      });

      expect(result).toMatchObject({
        available: true,
        resources: [
          { type: 'tool', found: true, registryKey: 'lookupCustomer', runtimeId: 'lookup-customer' },
          { type: 'agent', found: true, registryKey: 'supportAgent', runtimeId: 'support-agent' },
          {
            type: 'workflow',
            found: true,
            registryKey: 'greetingWorkflow',
            runtimeId: 'greeting-workflow',
            authoritativeWorkflowId: 'greeting-workflow',
          },
        ],
      });
    });
  });

  describe('when resource inspection is degraded', () => {
    it('returns catalog availability without mutating authoring state', async () => {
      const store = createStore({ context: { workflowCatalog: 'unavailable' } });
      const before = store.state;
      const result = await executeTool(store.tools['inspect-workflow-resources'], { resources: [] });

      expect(result).toEqual({ available: false, reason: 'catalog-unavailable', resources: [], catalog: [] });
      expect(store.state).toBe(before);
    });
  });

  describe('when a valid complete definition is submitted', () => {
    it('publishes the candidate and automatically makes the accepted revision ready', async () => {
      const candidates: WorkflowDraftCandidate[] = [];
      const store = createStore({
        context: validationContext,
        onCandidateChange: candidate => candidates.push(candidate),
      });
      const result = await executeTool(store.tools['submit-workflow-draft'], validDefinition);

      expect(result).toMatchObject({ success: true, lifecycle: 'ready', revision: 1, finalizedRevision: 1 });
      expect(store.state).toMatchObject({ lifecycle: 'ready', revision: 1, finalizedRevision: 1 });
      expect(candidates[0]?.draft).toMatchObject(validDefinition);
    });
  });

  describe('when an invalid complete definition is submitted', () => {
    it('preserves it for display and returns all validation diagnostics', async () => {
      let candidate: WorkflowDraftCandidate | undefined;
      const store = createStore({ context: validationContext, onCandidateChange: next => (candidate = next) });
      const result = await executeTool(store.tools['submit-workflow-draft'], {
        ...validDefinition,
        graph: [{ type: 'tool', id: 'lookup', toolId: 'missingTool' }],
      });

      expect(result).toMatchObject({
        success: false,
        issues: [expect.objectContaining({ code: 'missing-reference' })],
      });
      expect(store.state).toMatchObject({ revision: 0, lifecycle: 'untouched' });
      expect(candidate).toMatchObject({ hasUncheckpointedChanges: true, baseAcceptedRevision: 0 });
    });
  });

  describe('when a corrected complete definition replaces an invalid candidate', () => {
    it('accepts the replacement without model-facing repair or candidate-checkpoint choreography', async () => {
      const candidate = createWorkflowDraftCandidate(createWorkflowDraftAuthoringState('new-workflow'));
      const firstStore = createStore({ candidate, context: validationContext });
      await executeTool(firstStore.tools['submit-workflow-draft'], {
        ...validDefinition,
        graph: [{ type: 'tool', id: 'lookup', toolId: 'missingTool' }],
      });
      const secondStore = createStore({ candidate, context: validationContext });
      const result = await executeTool(secondStore.tools['submit-workflow-draft'], validDefinition);

      expect(result).toMatchObject({ success: true, lifecycle: 'ready', finalizedRevision: 1 });
      expect(secondStore.state.lifecycle).toBe('ready');
    });
  });

  describe('when a submission is superseded', () => {
    it('returns an anti-apology superseded response that references the earlier accepted submission', async () => {
      const store = createStore({ isCurrentGeneration: () => false, context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], validDefinition);

      expect(result).toMatchObject({
        success: false,
        reason: 'superseded',
        error: 'Submission was superseded.',
      });
      expect(result.message).toContain('earlier call');
      expect(result.message).toContain('inspect-workflow-resources');
      expect(result.message).toContain('Do NOT apologize');
      expect(store.state.revision).toBe(0);
    });
  });

  describe('when submit-workflow-draft is called with empty arguments', () => {
    it('returns an actionable diagnostic that names the provider truncation failure mode instead of a raw TypeError', async () => {
      const store = createStore({ context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], {});

      expect(result).toMatchObject({ success: false });
      expect(result.error).toContain('No workflow definition arguments');
      expect(result.message).toContain('provider may have truncated');
      expect(result.message).toContain('complete WorkflowDefinition');
      expect(result.message).toContain('Do NOT');
      expect(store.state).toMatchObject({ revision: 0, lifecycle: 'untouched' });
    });
  });

  describe('when a superseded submission structurally matches the accepted definition', () => {
    it('confirms it as a no-op success referencing the earlier accepted revision', async () => {
      // First accept a definition through a live store.
      const live = createStore({ context: validationContext });
      const first = await executeTool(live.tools['submit-workflow-draft'], validDefinition);
      expect(first).toMatchObject({ success: true, lifecycle: 'ready' });

      // Now issue a superseded resubmission with the same definition.
      const supersededTools = createWorkflowDraftTools({
        getState: () => live.state,
        checkpoint: () => ({ ok: false, state: live.state, error: 'unexpected checkpoint' }),
        finalize: () => ({ ok: false, state: live.state, error: 'unexpected finalize' }),
        validationContext,
        isCurrentGeneration: () => false,
      });
      const result = await executeTool(supersededTools['submit-workflow-draft'], validDefinition);

      expect(result).toMatchObject({
        success: true,
        lifecycle: 'ready',
        finalizedRevision: live.state.finalizedRevision,
      });
      expect(result.message).toContain('earlier');
      expect(result.message).toContain('no-op');
    });
  });
});
