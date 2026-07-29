import { describe, expect, it } from 'vitest';
import {
  normalizeWorkflowBuilderDefinition,
  WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION,
  workflowBuilderAgentEntryInputSchema,
  workflowBuilderConditionalEntryInputSchema,
  workflowBuilderDefinitionInputSchema,
  workflowBuilderDefinitionSchema,
  workflowBuilderForeachEntryInputSchema,
  workflowBuilderNestedWorkflowEntrySchema,
  workflowBuilderParallelEntryInputSchema,
} from './index';

const aliasedDefinition = {
  id: 'ticket-flow',
  inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
  outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  graph: [
    {
      type: 'mapping',
      id: 'build-prompt',
      mapConfig: { prompt: { template: 'Answer for ${initData.email}' } },
    },
    { type: 'agent', id: 'answer', agent: 'supportAgent' },
    {
      type: 'mapping',
      id: 'result',
      mapConfig: { text: { step: 'answer', path: 'text' } },
    },
  ],
};

describe('shared workflow builder authoring schema', () => {
  it('documents the canonical mapping source forms for every authoring surface', () => {
    expect(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION).toContain(
      '{ "initData": true, "path": "<workflow-input-field.path>" }',
    );
    expect(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION).toContain(
      'initData is the boolean true, never a field name string',
    );
    expect(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION).not.toContain('{ "initData": "<workflowId>"');
    expect(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION).toContain('${');
  });

  it('publishes the model-facing execution semantics both surfaces must advertise', () => {
    expect(workflowBuilderAgentEntryInputSchema.description).toContain(
      'Default agents consume { prompt: string } and return { text: string }',
    );
    // The call-site id addresses the nested workflow's result; it is independent
    // of the referenced workflowId (registry keys and intrinsic ids can differ).
    expect(workflowBuilderNestedWorkflowEntrySchema.description).toContain('stepResults.<id>');
    expect(workflowBuilderParallelEntryInputSchema.description).toContain(
      'Each child receives the same preceding input',
    );
    expect(workflowBuilderForeachEntryInputSchema.description).toContain(
      'Each item is passed directly to the child step',
    );
    expect(workflowBuilderConditionalEntryInputSchema.description).toContain('keyed by');
    expect(workflowBuilderDefinitionInputSchema.shape.graph.description).toContain(
      'The workflow result is exactly the final top-level entry output',
    );
    const serialized = JSON.stringify(
      workflowBuilderDefinitionInputSchema.shape.graph.description +
        String(workflowBuilderAgentEntryInputSchema.description),
    );
    expect(serialized).toBeTruthy();
  });

  describe('when a model submits a definition with authoring aliases', () => {
    it('accepts agent aliases and object-form mapping configs before normalization', () => {
      expect(() => workflowBuilderDefinitionInputSchema.parse(aliasedDefinition)).not.toThrow();
    });

    it('accepts the normalized form of the same definition through the strict schema', () => {
      const normalized = normalizeWorkflowBuilderDefinition(aliasedDefinition);
      const parsed = workflowBuilderDefinitionSchema.parse(normalized);
      expect(parsed.graph[1]).toEqual({ type: 'agent', id: 'answer', agentId: 'supportAgent' });
      expect(typeof (parsed.graph[0] as { mapConfig: string }).mapConfig).toBe('string');
    });
  });

  describe('when a mapping entry provides ambiguous sources', () => {
    it('rejects a mapping input that sets both mapConfig and output', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...aliasedDefinition,
        graph: [
          {
            type: 'mapping',
            id: 'ambiguous',
            mapConfig: { a: { value: 1 } },
            output: { b: { value: 2 } },
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('when a container entry carries fields the contract does not support', () => {
    // Regression: these were silently stripped, so a model that invented an input
    // selector got a definition that validated and then behaved nothing like what
    // it submitted. Unsupported fields must fail loudly instead.
    it.each([
      ['an invented foreach input selector', { type: 'foreach', input: { step: 'lookup', path: 'customers' } }],
      ['an invented foreach items selector', { type: 'foreach', items: { initData: true, path: 'customers' } }],
      ['a container id', { type: 'foreach', id: 'lookup-each' }],
    ])('rejects %s', (_label, extra) => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...aliasedDefinition,
        graph: [{ step: { type: 'tool', id: 'lookup', toolId: 'lookupCustomer' }, ...extra }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a bogus inputMapping descriptor on a container child', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...aliasedDefinition,
        graph: [
          {
            type: 'foreach',
            step: {
              type: 'tool',
              id: 'lookup',
              toolId: 'lookupCustomer',
              inputMapping: { foreach: true, path: 'email' },
            },
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('when predicates reference noncanonical scopes', () => {
    it('rejects predicate paths outside the declarative namespaces', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...aliasedDefinition,
        graph: [
          {
            type: 'conditional',
            steps: [{ type: 'tool', id: 'lookup', toolId: 'lookupCustomer' }],
            predicates: [{ op: 'exists', path: 'steps.lookup.result' }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
