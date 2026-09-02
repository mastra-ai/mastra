import { describe, expect, it } from 'vitest';
import {
  normalizeWorkflowBuilderDefinition,
  WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION,
  workflowBuilderAgentEntrySchema,
  workflowBuilderConditionalEntrySchema,
  workflowBuilderDefinitionInputSchema,
  workflowBuilderDefinitionSchema,
  workflowBuilderForeachEntrySchema,
  workflowBuilderNestedWorkflowEntrySchema,
  workflowBuilderParallelEntrySchema,
  workflowBuilderScheduleConfigSchema,
  storedWorkflowDefinitionSchema,
} from './index';

// The model-facing input dialect: canonical entries plus object-form mapConfig.
const authoringDefinition = {
  id: 'ticket-flow',
  inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
  outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  graph: [
    {
      type: 'mapping',
      id: 'build-prompt',
      mapConfig: { prompt: { template: 'Answer for ${initData.email}' } },
    },
    { type: 'agent', id: 'answer', agentId: 'supportAgent' },
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
    expect(workflowBuilderAgentEntrySchema.description).toContain(
      'Default agents consume { prompt: string } and return { text: string }',
    );
    // The call-site id addresses the nested workflow's result; it is independent
    // of the referenced workflowId (registry keys and intrinsic ids can differ).
    expect(workflowBuilderNestedWorkflowEntrySchema.description).toContain('stepResults.<id>');
    expect(workflowBuilderParallelEntrySchema.description).toContain('Each child receives the same preceding input');
    expect(workflowBuilderForeachEntrySchema.description).toContain('Each item is passed directly to the child step');
    expect(workflowBuilderConditionalEntrySchema.description).toContain('keyed by');
    expect(workflowBuilderDefinitionInputSchema.shape.graph.description).toContain(
      'The workflow result is exactly the final top-level entry output',
    );
  });

  describe('stored workflow API contract', () => {
    it('preserves definition metadata and graph fidelity in stored responses', () => {
      const definition = workflowBuilderDefinitionSchema.parse({
        ...normalizeWorkflowBuilderDefinition(authoringDefinition),
        metadata: { owner: 'support' },
      });

      const stored = storedWorkflowDefinitionSchema.parse({
        ...definition,
        status: 'active',
        source: 'storage',
        createdAt: '2026-07-29T00:00:00.000Z',
        updatedAt: new Date('2026-07-29T00:01:00.000Z'),
      });

      expect(stored.metadata).toEqual({ owner: 'support' });
      expect(stored.graph).toEqual(definition.graph);
    });
  });

  describe('when a model submits the input dialect', () => {
    it('accepts object-form mapping configs before normalization', () => {
      expect(() => workflowBuilderDefinitionInputSchema.parse(authoringDefinition)).not.toThrow();
    });

    it('accepts the normalized form of the same definition through the strict schema', () => {
      const normalized = normalizeWorkflowBuilderDefinition(authoringDefinition);
      const parsed = workflowBuilderDefinitionSchema.parse(normalized);
      expect(parsed.graph[1]).toEqual({ type: 'agent', id: 'answer', agentId: 'supportAgent' });
      expect(typeof (parsed.graph[0] as { mapConfig: string }).mapConfig).toBe('string');
    });

    it('rejects unknown definition-level fields in both authoring dialects', () => {
      expect(workflowBuilderDefinitionInputSchema.safeParse({ ...authoringDefinition, unexpected: true }).success).toBe(
        false,
      );
      expect(
        workflowBuilderDefinitionSchema.safeParse({
          ...normalizeWorkflowBuilderDefinition(authoringDefinition),
          unexpected: true,
        }).success,
      ).toBe(false);
    });

    it('does not stringify a null mapping config into a valid canonical string', () => {
      const normalized = normalizeWorkflowBuilderDefinition({
        ...authoringDefinition,
        graph: [{ type: 'mapping', id: 'shape', mapConfig: null }],
      });

      expect(workflowBuilderDefinitionSchema.safeParse(normalized).success).toBe(false);
    });
  });

  // The alias fields (`agent`, mapping `output`) are gone from the model-facing
  // contract: OpenAI strict-schema compatibility makes every optional property
  // required, which turned each alias pair into an unfillable contradiction.
  // They must now fail loudly instead of being advertised.
  describe('when a model submits removed authoring aliases', () => {
    it('rejects the agent alias for agentId', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...authoringDefinition,
        graph: [{ type: 'agent', id: 'answer', agent: 'supportAgent' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects the output alias for mapConfig', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...authoringDefinition,
        graph: [{ type: 'mapping', id: 'shape', output: { text: { value: 'hi' } } }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a mapping that carries output alongside mapConfig instead of silently dropping it', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...authoringDefinition,
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

    it('rejects removed aliases in the canonical schema too', () => {
      const agentAlias = workflowBuilderDefinitionSchema.safeParse({
        ...normalizeWorkflowBuilderDefinition(authoringDefinition),
        graph: [{ type: 'agent', id: 'answer', agent: 'supportAgent' }],
      });
      const mappingAlias = workflowBuilderDefinitionSchema.safeParse({
        ...normalizeWorkflowBuilderDefinition(authoringDefinition),
        graph: [{ type: 'mapping', id: 'shape', mapConfig: '{}', output: { text: { value: 'hi' } } }],
      });

      expect(agentAlias.success).toBe(false);
      expect(mappingAlias.success).toBe(false);
    });
  });

  // OpenAI strict compatibility makes optional properties required+nullable, so
  // strict-provider models emit null where they would otherwise omit the field.
  describe('when a strict-provider model emits null for optional fields', () => {
    it('normalizes entry-level nulls away so the canonical schema accepts the definition', () => {
      const normalized = normalizeWorkflowBuilderDefinition({
        ...authoringDefinition,
        description: null,
        metadata: null,
        stateSchema: null,
        requestContextSchema: null,
        graph: [
          {
            type: 'agent',
            id: 'answer',
            agentId: 'supportAgent',
            description: null,
            outputSchema: null,
            options: null,
          },
          {
            type: 'mapping',
            id: 'result',
            mapConfig: { text: { step: 'answer', path: 'text' }, keep: { value: null } },
          },
        ],
      });
      const parsed = workflowBuilderDefinitionSchema.parse(normalized);
      expect(parsed.graph[0]).toEqual({ type: 'agent', id: 'answer', agentId: 'supportAgent' });
      // A mapping constant null is data, not an omitted field — it must survive.
      expect(JSON.parse((parsed.graph[1] as { mapConfig: string }).mapConfig).keep).toEqual({ value: null });
    });

    it('normalizes nulls inside step options and foreach opts', () => {
      const normalized = normalizeWorkflowBuilderDefinition({
        ...authoringDefinition,
        graph: [
          {
            type: 'foreach',
            step: {
              type: 'agent',
              id: 'each',
              agentId: 'supportAgent',
              options: { retries: null, metadata: null },
            },
            opts: { concurrency: null },
          },
        ],
      });
      const parsed = workflowBuilderDefinitionSchema.parse(normalized);
      const foreach = parsed.graph[0] as { step: { options?: object }; opts?: object };
      // Emptied containers are dropped: canonical foreach opts requires concurrency.
      expect(foreach.step.options).toBeUndefined();
      expect(foreach.opts).toBeUndefined();
    });
  });

  describe('when a canonical entry carries fields the contract does not support', () => {
    it.each([
      ['a mapping alias', { type: 'mapping', id: 'shape', mapConfig: '{}', output: { text: { value: 'hi' } } }],
      ['an extra sleep field', { type: 'sleep', id: 'pause', duration: 100, until: 'tomorrow' }],
      ['an extra sleepUntil field', { type: 'sleepUntil', id: 'pause', date: '2026-08-12', duration: 100 }],
      [
        'an extra predicate field',
        {
          type: 'conditional',
          steps: [{ type: 'tool', id: 'lookup', toolId: 'lookupCustomer' }],
          predicates: [{ op: 'exists', path: 'inputData.email', extra: true }],
        },
      ],
    ])('rejects %s', (_label, entry) => {
      const result = workflowBuilderDefinitionSchema.safeParse({
        ...normalizeWorkflowBuilderDefinition(authoringDefinition),
        graph: [entry],
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
        ...authoringDefinition,
        graph: [{ step: { type: 'tool', id: 'lookup', toolId: 'lookupCustomer' }, ...extra }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a bogus inputMapping descriptor on a container child', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...authoringDefinition,
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

  describe('schedule configuration', () => {
    it('accepts valid cron, timezone, and nested JSON values', () => {
      expect(
        workflowBuilderScheduleConfigSchema.safeParse({
          cron: '0 9 * * 1',
          timezone: 'America/New_York',
          inputData: { nested: [null, true, 42, 'value'] },
          requestContext: { tenant: { id: 'acme' } },
        }).success,
      ).toBe(true);
    });

    it.each([
      { cron: 'not a cron' },
      { cron: '0 9 * * 1', timezone: 'Not/A_Timezone' },
      { cron: '0 9 * * 1', inputData: { invalid: undefined } },
      { cron: '0 9 * * 1', initialState: new Date() },
      { cron: '0 9 * * 1', metadata: { invalid: Number.POSITIVE_INFINITY } },
    ])('rejects invalid schedule config %#', schedule => {
      expect(workflowBuilderScheduleConfigSchema.safeParse(schedule).success).toBe(false);
    });
  });

  describe('when predicates reference noncanonical scopes', () => {
    it('rejects predicate paths outside the declarative namespaces', () => {
      const result = workflowBuilderDefinitionInputSchema.safeParse({
        ...authoringDefinition,
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
