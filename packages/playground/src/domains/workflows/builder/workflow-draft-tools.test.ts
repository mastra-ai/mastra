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
          { type: 'workflow', found: true, registryKey: 'greetingWorkflow', runtimeId: 'greeting-workflow' },
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

  describe('when a previous submission is superseded', () => {
    it('rejects before mutating the accepted draft', async () => {
      const store = createStore({ isCurrentGeneration: () => false, context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], validDefinition);

      expect(result).toEqual({ success: false, error: 'Submission was superseded.' });
      expect(store.state.revision).toBe(0);
    });
  });
});
