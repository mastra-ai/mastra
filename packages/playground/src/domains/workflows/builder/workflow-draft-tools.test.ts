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

  describe('when a valid complete definition becomes the accepted revision', () => {
    it('echoes the authoritative accepted definition so the model can verify it without another inspection', async () => {
      const store = createStore({ context: validationContext });
      const result = (await executeTool(store.tools['submit-workflow-draft'], validDefinition)) as {
        success: boolean;
        definition?: unknown;
      };

      expect(result.success).toBe(true);
      expect(result.definition).toEqual(store.state.draft);
      expect(result.definition).toMatchObject({
        id: 'new-workflow',
        graph: [expect.objectContaining({ id: 'lookup', toolId: 'lookupCustomer' })],
      });
    });
  });

  describe('when the definition nests helper workflows that do not exist yet', () => {
    const customerSchema = {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId'],
      additionalProperties: false,
    };
    const helper = (id: string, sourceField: string) => ({
      id,
      description: `Looks up the customer named by ${sourceField}.`,
      inputSchema: {
        type: 'object',
        properties: { [sourceField]: { type: 'string' } },
        required: [sourceField],
        additionalProperties: false,
      },
      outputSchema: customerSchema,
      graph: [
        {
          type: 'mapping' as const,
          id: 'to-lookup-input',
          mapConfig: { email: { initData: true, path: sourceField } },
        },
        { type: 'tool' as const, id: 'lookup', toolId: 'lookupCustomer' },
      ],
    });
    // The R3 shape: parallel branches all receive the same object, so the only
    // way to look up two different emails is one helper workflow per branch.
    const rootWithHelpers = {
      id: 'parallel-customer-lookup-workflow',
      inputSchema: {
        type: 'object',
        properties: { firstEmail: { type: 'string' }, secondEmail: { type: 'string' } },
        required: ['firstEmail', 'secondEmail'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: { first: customerSchema, second: customerSchema },
        required: ['first', 'second'],
        additionalProperties: false,
      },
      graph: [
        {
          type: 'parallel' as const,
          steps: [
            { type: 'workflow' as const, id: 'first-lookup', workflowId: 'lookup-first-customer' },
            { type: 'workflow' as const, id: 'second-lookup', workflowId: 'lookup-second-customer' },
          ],
        },
        {
          type: 'mapping' as const,
          id: 'merge-lookups',
          mapConfig: { first: { step: 'first-lookup', path: '' }, second: { step: 'second-lookup', path: '' } },
        },
      ],
      dependencies: [helper('lookup-first-customer', 'firstEmail'), helper('lookup-second-customer', 'secondEmail')],
    };

    it('resolves them from the submission itself so the whole set becomes one Ready draft', async () => {
      const store = createStore({ context: validationContext });
      const result = (await executeTool(store.tools['submit-workflow-draft'], rootWithHelpers)) as {
        success: boolean;
        definition?: { dependencies?: Array<{ id: string }> };
      };

      expect(result.success).toBe(true);
      expect(store.state).toMatchObject({ lifecycle: 'ready', revision: 1 });
      // The helpers ride along on the accepted draft, so the user's Save sends
      // them with the root as one unit.
      expect(result.definition?.dependencies?.map(dependency => dependency.id)).toEqual([
        'lookup-first-customer',
        'lookup-second-customer',
      ]);
    });

    it('still rejects a nested reference no helper supplies', async () => {
      const store = createStore({ context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], {
        ...rootWithHelpers,
        dependencies: [helper('lookup-first-customer', 'firstEmail')],
      });

      expect(result).toMatchObject({
        success: false,
        issues: [expect.objectContaining({ code: 'missing-reference' })],
      });
      expect(store.state).toMatchObject({ lifecycle: 'untouched' });
    });

    it('reports a broken helper against its own path instead of blaming the root', async () => {
      const store = createStore({ context: validationContext });
      const brokenHelper = helper('lookup-second-customer', 'secondEmail');
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...rootWithHelpers,
        dependencies: [
          helper('lookup-first-customer', 'firstEmail'),
          { ...brokenHelper, graph: [{ type: 'tool', id: 'lookup', toolId: 'missingTool' }] },
        ],
      })) as { success: boolean; issues?: Array<{ code: string; path: string }> };

      expect(result.success).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'missing-reference', path: 'dependencies.1.graph.0.toolId' }),
      );
    });

    it('rejects a helper that nests the workflow being built, because the set has no save order', async () => {
      const store = createStore({ context: validationContext });
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...rootWithHelpers,
        dependencies: [
          {
            ...helper('lookup-first-customer', 'firstEmail'),
            graph: [{ type: 'workflow', id: 'back-to-root', workflowId: 'parallel-customer-lookup-workflow' }] as never,
          },
          helper('lookup-second-customer', 'secondEmail'),
        ],
      })) as { success: boolean; issues?: Array<{ message: string }> };

      expect(result.success).toBe(false);
      expect(result.issues?.some(issue => issue.message.includes('cycle'))).toBe(true);
      expect(store.state).toMatchObject({ lifecycle: 'untouched' });
    });

    it('rejects a helper that reuses the id of the workflow being built', async () => {
      const store = createStore({ context: validationContext });
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...rootWithHelpers,
        dependencies: [helper('parallel-customer-lookup-workflow', 'firstEmail')],
      })) as { success: boolean; issues?: Array<{ code: string; path: string }> };

      expect(result.success).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'invalid-workflow-id', path: 'dependencies.0.id' }),
      );
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

  describe('when generation was stopped before a submission was evaluated', () => {
    it('reports the stop truthfully instead of claiming an earlier submission was accepted', async () => {
      const store = createStore({ isCurrentGeneration: () => false, context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], validDefinition);

      expect(result).toMatchObject({
        success: false,
        reason: 'generation-stopped',
        error: 'Workflow generation was stopped before this submission was evaluated.',
        lifecycle: 'untouched',
        baseAcceptedRevision: 0,
      });
      // Nothing was accepted, so the response must never imply otherwise.
      expect(result.message).not.toContain('earlier call');
      expect(result.message).not.toContain('was accepted first');
      expect(result.message).toContain('Nothing has been accepted');
      expect(result.message).toContain('Do NOT apologize');
      expect(store.state.revision).toBe(0);
    });
  });

  describe('when submit-workflow-draft is called with empty arguments', () => {
    it('returns an actionable diagnostic that names the provider truncation failure mode instead of a raw TypeError', async () => {
      const store = createStore({ context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], {});

      expect(result).toMatchObject({ success: false, reason: 'empty-arguments' });
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
      expect(result.definition).toEqual(live.state.draft);
    });
  });

  describe('when a superseded submission arrives while the workflow is already ready', () => {
    it('returns a short already-ready response that names the accepted revision and tells the model to stop', async () => {
      // Accept a definition through a live store so the workflow is Ready.
      const live = createStore({ context: validationContext });
      const first = await executeTool(live.tools['submit-workflow-draft'], validDefinition);
      expect(first).toMatchObject({ success: true, lifecycle: 'ready', finalizedRevision: 1 });

      // Now a later, structurally-different submission arrives after generation moved on.
      const supersededTools = createWorkflowDraftTools({
        getState: () => live.state,
        checkpoint: () => ({ ok: false, state: live.state, error: 'unexpected checkpoint' }),
        finalize: () => ({ ok: false, state: live.state, error: 'unexpected finalize' }),
        validationContext,
        isCurrentGeneration: () => false,
      });
      const result = await executeTool(supersededTools['submit-workflow-draft'], {
        ...validDefinition,
        graph: [
          { type: 'tool', id: 'lookup', toolId: 'lookupCustomer' },
          { type: 'mapping', id: 'extra', mapConfig: { customerId: { step: 'lookup', path: 'customerId' } } },
        ],
      });

      expect(result).toMatchObject({
        success: false,
        reason: 'already-ready',
        lifecycle: 'ready',
        finalizedRevision: live.state.finalizedRevision,
      });
      expect(result.error).toContain('already');
      // Short, actionable, no long apology block.
      expect(result.message ?? '').toMatch(/already Ready/i);
      expect(result.message ?? '').toMatch(/wait for the user/i);
      expect((result.message ?? '').length).toBeLessThan(400);
      // The rejected submission must not become the reported definition.
      expect(result.definition).toEqual(live.state.draft);
      expect((result.definition as { graph: unknown[] }).graph).toHaveLength(1);
    });
  });
});
