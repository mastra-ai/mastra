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

const toolInputSchema = (tool: unknown) => {
  if (!tool || typeof tool !== 'object' || !('inputSchema' in tool)) {
    throw new Error('Expected client tool with an input schema');
  }
  return tool.inputSchema as { safeParse: (input: unknown) => { success: boolean } };
};

const executeTool = async (tool: unknown, input: unknown) => {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Expected executable client tool');
  }
  return tool.execute(input, { toolCallId: 'test-call', messages: [] });
};

const validationContext: WorkflowDraftValidationContext = {
  agents: { supportAgent: { runtimeId: 'support-agent', description: 'Answers support questions' } },
  tools: {
    lookupCustomer: {
      runtimeId: 'lookup-customer',
      description: 'Looks a customer up by email',
      inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      outputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
    },
  },
  workflows: {
    greetingWorkflow: {
      runtimeId: 'greeting-workflow',
      description: 'Greets a person by name',
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
    it('exposes one eager listing per resource type plus whole-definition submission', () => {
      expect(Object.keys(createStore().tools)).toEqual([
        'list-available-agents',
        'list-available-tools',
        'list-available-workflows',
        'submit-workflow-draft',
      ]);
    });

    it.each(['list-available-agents', 'list-available-tools', 'list-available-workflows'])(
      'lets the model call %s with no arguments',
      async toolId => {
        const { tools } = createStore({ context: validationContext });

        expect(toolInputSchema(tools[toolId]).safeParse({}).success).toBe(true);
        await expect(executeTool(tools[toolId], {})).resolves.toBeDefined();
      },
    );
  });

  describe('when registered resources are listed', () => {
    it('returns every agent with its output contract in one call', async () => {
      const { tools } = createStore({ context: validationContext });

      expect(await executeTool(tools['list-available-agents'], {})).toEqual({
        agents: [
          {
            registryKey: 'supportAgent',
            runtimeId: 'support-agent',
            description: 'Answers support questions',
            outputContract: expect.stringContaining('outputSchema'),
          },
        ],
      });
    });

    it('returns every tool with both schemas in one call', async () => {
      const { tools } = createStore({ context: validationContext });

      expect(await executeTool(tools['list-available-tools'], {})).toEqual({
        tools: [
          {
            registryKey: 'lookupCustomer',
            runtimeId: 'lookup-customer',
            description: 'Looks a customer up by email',
            inputSchema: validationContext.tools!.lookupCustomer.inputSchema,
            outputSchema: validationContext.tools!.lookupCustomer.outputSchema,
          },
        ],
      });
    });

    it('returns every workflow with the id that nested entries must reference', async () => {
      const { tools } = createStore({ context: validationContext });

      expect(await executeTool(tools['list-available-workflows'], {})).toEqual({
        available: true,
        workflows: [
          {
            registryKey: 'greetingWorkflow',
            authoritativeWorkflowId: 'greeting-workflow',
            description: 'Greets a person by name',
            inputSchema: validationContext.workflows!.greetingWorkflow.inputSchema,
            outputSchema: validationContext.workflows!.greetingWorkflow.outputSchema,
          },
        ],
      });
    });
  });

  describe('when the workflow catalog is withheld', () => {
    it('reports the workflow catalog unavailable without mutating authoring state', async () => {
      const store = createStore({ context: { ...validationContext, workflowCatalog: 'unavailable' } });
      const before = store.state;

      expect(await executeTool(store.tools['list-available-workflows'], {})).toEqual({
        available: false,
        reason: 'catalog-unavailable',
        workflows: [],
      });
      expect(store.state).toBe(before);
    });

    it('still lists agents and tools, which are not gated behind workflow permission', async () => {
      const { tools } = createStore({ context: { ...validationContext, workflowCatalog: 'unavailable' } });

      expect(await executeTool(tools['list-available-agents'], {})).toMatchObject({
        agents: [{ registryKey: 'supportAgent' }],
      });
      expect(await executeTool(tools['list-available-tools'], {})).toMatchObject({
        tools: [{ registryKey: 'lookupCustomer' }],
      });
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

  describe('when a graph entry is structurally malformed so the canonical schema cannot parse it', () => {
    it('returns the schema issues as an actionable diagnostic instead of throwing an opaque tool error', async () => {
      let candidate: WorkflowDraftCandidate | undefined;
      const store = createStore({ context: validationContext, onCandidateChange: next => (candidate = next) });
      // The exact wrong foreach shape a model guesses when it does not follow the
      // canonical `{ type: "foreach", step: {...}, opts: {...} }` grammar. This
      // fails the discriminated union in the canonical schema, which previously
      // threw a raw ZodError out of execute — the model then saw an opaque
      // failure with no hint about which keys were wrong.
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...validDefinition,
        graph: [{ type: 'foreach', id: 'loop', items: 'x', itemWorkflow: 'greetingWorkflow' }],
      })) as { success: boolean; error?: string; issues?: unknown[] };

      expect(result.success).toBe(false);
      // Studio routes structural failures through Core's own tool-input
      // validation, so the model reads exactly what it would from a native Core
      // tool: the standard preamble, one `- path: message` line per issue, and
      // the arguments it actually sent.
      expect(result.error).toContain('Tool input validation failed for submit-workflow-draft');
      expect(result.error).toContain('Provided arguments:');
      // The offending keys are named at their path, so the model can correct the
      // shape instead of guessing key names.
      expect(result.error).toContain('graph.0: Unrecognized keys: "id", "items", "itemWorkflow"');
      // A malformed submission never became a candidate, so it must not clobber
      // authoring state or the previously displayed draft.
      expect(store.state).toMatchObject({ revision: 0, lifecycle: 'untouched' });
      expect(candidate).toBeUndefined();
    });

    it('reports a non-array graph as a validation issue rather than escaping as a thrown normalization error', async () => {
      let candidate: WorkflowDraftCandidate | undefined;
      const store = createStore({ context: validationContext, onCandidateChange: next => (candidate = next) });
      // Canonicalization refuses input it cannot normalize by throwing, and Zod
      // does not catch throws out of `preprocess`. A model that wraps its graph
      // in an object must still get a normal validation issue back.
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...validDefinition,
        graph: { steps: [] },
      })) as { success: boolean; error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool input validation failed for submit-workflow-draft');
      expect(result.error).toContain('graph:');
      expect(store.state).toMatchObject({ revision: 0, lifecycle: 'untouched' });
      expect(candidate).toBeUndefined();
    });

    it('rejects an unknown step type at its path without mutating authoring state', async () => {
      let candidate: WorkflowDraftCandidate | undefined;
      const store = createStore({ context: validationContext, onCandidateChange: next => (candidate = next) });
      // The model used "map" instead of the canonical "mapping" — a bad
      // discriminator value, so no union branch is even attempted.
      const result = (await executeTool(store.tools['submit-workflow-draft'], {
        ...validDefinition,
        graph: [{ type: 'map', id: 'shape', mapConfig: {} }],
      })) as { success: boolean; error?: string; issues?: unknown[] };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool input validation failed for submit-workflow-draft');
      // Core reports the bad discriminator at its own path and enumerates every
      // legal step type, so the model can pick the canonical one directly.
      expect(result.error).toContain('graph.0.type: Invalid discriminator value');
      expect(result.error).toContain("'mapping'");
      expect(result.error).toContain("'foreach'");
      expect(result.error).toContain("'agent'");
      expect(store.state).toMatchObject({ revision: 0, lifecycle: 'untouched' });
      expect(candidate).toBeUndefined();
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
        lifecycle: 'untouched',
        baseAcceptedRevision: 0,
      });
      // Nothing was accepted, so the response must never imply otherwise.
      expect(result.error).not.toContain('earlier call');
      expect(result.error).not.toContain('was accepted first');
      // Recovery guidance rides on `error`, the field models actually act on.
      expect(result.error).toContain('Nothing has been accepted');
      expect(result.error).toContain('Do NOT apologize');
      expect(store.state.revision).toBe(0);
    });
  });

  describe('when submit-workflow-draft is called with empty arguments', () => {
    it('returns an actionable diagnostic that tells the model to compose the definition before calling, instead of a raw TypeError', async () => {
      const store = createStore({ context: validationContext });
      const result = await executeTool(store.tools['submit-workflow-draft'], {});

      expect(result).toMatchObject({ success: false, reason: 'empty-arguments' });
      // A model that reads only `error` still learns what failed, how to retry,
      // and what not to do. Nothing actionable may live in a sibling field.
      expect(result.error).toContain('with no arguments');
      expect(result.error).toContain('Compose the complete WorkflowDefinition');
      expect(result.error).toContain('Do NOT');
      // The old text blamed provider truncation, which misled the model into
      // resending the same empty payload. The failure is the model calling
      // before building the definition, so that guess must not resurface.
      expect(result.error).not.toContain('truncated');
      expect(result.message).toBeUndefined();
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
      // Short, actionable, no long apology block — and self-contained in `error`.
      expect(result.error ?? '').toMatch(/already Ready/i);
      expect(result.error ?? '').toMatch(/wait for the user/i);
      expect((result.error ?? '').length).toBeLessThan(400);
      // The rejected submission must not become the reported definition.
      expect(result.definition).toEqual(live.state.draft);
      expect((result.definition as { graph: unknown[] }).graph).toHaveLength(1);
    });
  });
});
