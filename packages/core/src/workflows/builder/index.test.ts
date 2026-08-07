import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compareWorkflowBuilderSchemas,
  createWorkflowBuilderAgent,
  inspectWorkflowBuilderSchemas,
  normalizeWorkflowBuilderDefinition,
  preflightWorkflowDefinition,
  WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS,
  WORKFLOW_BUILDER_AUTHORING_PLAYBOOK,
  WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES,
} from './index';

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../../test-fixtures/workflow-builder-canonical/definitions.json', import.meta.url)),
    'utf8',
  ),
) as Array<{ name: string; input: unknown; expected: unknown }>;

describe('workflow builder authoring contract', () => {
  it('publishes all ten persisted graph families', () => {
    expect(WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES).toEqual([
      'agent',
      'tool',
      'mapping',
      'workflow',
      'parallel',
      'foreach',
      'sleep',
      'sleepUntil',
      'conditional',
      'loop',
    ]);
  });

  it('keeps the shared JSON-safe authoring constraints available to every authoring frontend', () => {
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('JSON-safe static graph');
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('Never invent agent, tool, or workflow IDs');
  });

  it('publishes the shared composition playbook without surface mutation semantics', () => {
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# How a workflow runs');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Composition procedure');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('Run the shared pre-action check');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Shared summary rules');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# The composition rule — schemas MUST match');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Mappings — how to reshape data between steps');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '# Fan-out, iteration, and waiting — the container step types',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Conditional branches and loops — declarative predicates');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Nested workflows — compose one workflow inside another');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain("# Anti-patterns — don't do these");
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '# Worked example: foreach — run an agent on each item of a list',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Definition quality');
    // Both parallel branch-input patterns, the capability boundaries the model
    // must not paper over, and the mapping source that was previously untaught.
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('**Giving parallel branches different inputs.**');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '*Pattern A — one shared object, each branch reads its own field.*',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '*Pattern B — two branches call the SAME resource on different values.*',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('{ "requestContextPath": "<field.path>" }');
    // Collapsing mutually exclusive conditional branches. Models repeatedly emitted
    // `${stepResults.a.f}${stepResults.b.f}` here, which throws on the unfired branch,
    // so the step-array source must be taught in the mapping list, the conditional
    // section, and the anti-patterns.
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '{ "step": ["<stepIdA>", "<stepIdB>", ...], "path": "<field.path>" }',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('**Collapsing branches back into one field.**');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      '"mapConfig": "{\\"response\\":{\\"step\\":[\\"urgent-support\\",\\"normal-support\\"],\\"path\\":\\"text\\"}}"',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('❌ Concatenating `conditional` branches in a template');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('Human-in-the-loop **suspend / resume**');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('State is **read-only** to the graph you author');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('# Out of scope — do NOT emit these');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).not.toContain('submit-workflow-draft');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).not.toContain('save-workflow');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).not.toContain('save-workflow exactly once');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).not.toContain('superseded');
  });

  it('composes the shared playbook with a concrete surface policy', async () => {
    const agent = createWorkflowBuilderAgent({
      id: 'test-workflow-builder',
      name: 'Test Workflow Builder',
      model: 'openai/gpt-5.5',
      surfaceInstructions: '# Test surface policy\n\nCall save-test exactly once.',
    });

    const instructions = await agent.getInstructions();

    expect(instructions).toContain('# The composition rule — schemas MUST match');
    expect(instructions).toContain('# Test surface policy');
    expect(instructions).toContain('Call save-test exactly once.');
  });

  it('documents canonical direct mapping sources and container output semantics', () => {
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('`{ "initData": true, "path": "<field.path>" }`');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('`{ "step": "<stepId>", "path": "<field.path>" }`');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain('references **exactly one** source');
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain(
      'The inner step receives ONE ELEMENT of the array at a time as its input, without coercion.',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_PLAYBOOK).toContain("complete output of **every** child under that child's id");
  });

  it.each(fixtures)('normalizes the $name fixture deterministically', ({ input, expected }) => {
    const normalized = normalizeWorkflowBuilderDefinition(input);
    expect(normalized).toEqual(expected);
    expect(normalizeWorkflowBuilderDefinition(normalized)).toEqual(expected);
  });

  it('preserves nested workflow call-site ids that differ from the referenced workflow id', () => {
    const definition = normalizeWorkflowBuilderDefinition({
      id: 'outer-flow',
      inputSchema: {},
      outputSchema: {},
      graph: [
        {
          type: 'parallel',
          steps: [{ type: 'workflow', id: 'local-child', workflowId: 'shared-child' }],
        },
      ],
    });
    // The call-site id is how the definition addresses this step's result, so it
    // must survive verbatim — never coerced to workflowId. A registry key or an
    // intrinsic workflow id may legitimately differ from the call-site id.
    expect((definition.graph[0] as any).steps[0]).toEqual({
      type: 'workflow',
      id: 'local-child',
      workflowId: 'shared-child',
    });
    expect(preflightWorkflowDefinition(definition)).toEqual({ ok: true });
  });

  it('rejects function-bearing definitions', () => {
    expect(() =>
      normalizeWorkflowBuilderDefinition({
        id: 'closure-flow',
        inputSchema: {},
        outputSchema: {},
        graph: [{ type: 'mapping', id: 'map', mapConfig: () => ({}) }],
      }),
    ).toThrow('must be JSON-safe');
  });

  it('drops null metadata like the other optional schema fields', () => {
    // Weaker authoring models emit explicit `metadata: null` for the optional
    // field. Mirror the stateSchema/requestContextSchema handling so the null
    // key never reaches the persisted definition, whose schema is `.optional()`.
    const definition = normalizeWorkflowBuilderDefinition({
      id: 'null-metadata-flow',
      inputSchema: {},
      outputSchema: {},
      metadata: null,
      graph: [{ type: 'mapping', id: 'map', mapConfig: { output: { value: { initData: 'value' } } } }],
    });
    expect('metadata' in definition).toBe(false);
  });

  describe('when a definition is preflighted for execution', () => {
    const inputSchema = {
      type: 'object',
      properties: { email: { type: 'string' }, summary: { type: 'string' } },
      required: ['email', 'summary'],
    };
    const lookupOutputSchema = {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId'],
    };

    it('accepts canonical mappings from init data and preceding local step results', () => {
      const result = preflightWorkflowDefinition(
        {
          id: 'ticket-flow',
          inputSchema,
          outputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
          graph: [
            {
              type: 'mapping',
              id: 'lookup-input',
              mapConfig: JSON.stringify({ email: { initData: true, path: 'email' } }),
            },
            { type: 'tool', id: 'lookup-customer', toolId: 'lookupCustomer' },
            {
              type: 'mapping',
              id: 'result',
              mapConfig: JSON.stringify({ customerId: { step: 'lookup-customer', path: 'customerId' } }),
            },
          ],
        },
        {
          tools: {
            lookupCustomer: {
              inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
              outputSchema: lookupOutputSchema,
            },
          },
        },
      );

      expect(result).toEqual({ ok: true });
    });

    it('rejects duplicate local ids and unavailable dependencies', () => {
      const result = preflightWorkflowDefinition(
        {
          id: 'invalid-flow',
          inputSchema: {},
          outputSchema: {},
          graph: [
            { type: 'tool', id: 'duplicate', toolId: 'missingTool' },
            { type: 'agent', id: 'duplicate', agentId: 'missingAgent' },
          ],
        },
        { agents: {}, tools: {}, workflows: {} },
      );

      expect(result).toEqual({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'missing-reference', path: 'graph.0.toolId' }),
          expect.objectContaining({ code: 'duplicate-step-id', path: 'graph.1.id' }),
          expect.objectContaining({ code: 'missing-reference', path: 'graph.1.agentId' }),
        ]),
      });
    });

    it('rejects noncanonical paths and local step references that are missing or not preceding', () => {
      const result = preflightWorkflowDefinition({
        id: 'invalid-mappings',
        inputSchema,
        outputSchema: {},
        graph: [
          {
            type: 'mapping',
            id: 'bad-json-path',
            mapConfig: JSON.stringify({ summary: { initData: true, path: '$.summary' } }),
          },
          {
            type: 'mapping',
            id: 'future-reference',
            mapConfig: JSON.stringify({ customerId: { step: 'lookup-customer', path: 'customerId' } }),
          },
          { type: 'tool', id: 'lookup-customer', toolId: 'lookupCustomer' },
          {
            type: 'mapping',
            id: 'missing-reference',
            mapConfig: JSON.stringify({ customerId: { step: 'not-a-step', path: 'customerId' } }),
          },
        ],
      });

      expect(result).toEqual({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'invalid-map-config', path: 'graph.0.mapConfig.summary.path' }),
          expect.objectContaining({ code: 'invalid-map-reference', path: 'graph.1.mapConfig.customerId.step' }),
          expect.objectContaining({ code: 'invalid-map-reference', path: 'graph.3.mapConfig.customerId.step' }),
        ]),
      });
    });

    it('rejects mapping entries inside containers', () => {
      const result = preflightWorkflowDefinition({
        id: 'invalid-container',
        inputSchema: {},
        outputSchema: {},
        graph: [
          {
            type: 'parallel',
            steps: [{ type: 'mapping', id: 'map-child', mapConfig: JSON.stringify({ value: { value: true } }) }] as any,
          },
        ],
      });

      expect(result).toEqual({
        ok: false,
        issues: [expect.objectContaining({ code: 'invalid-map-placement', path: 'graph.0.steps.0' })],
      });
    });

    it('exposes canonical schema inspection for authoring frontends', () => {
      const definition = normalizeWorkflowBuilderDefinition({
        id: 'parallel-flow',
        inputSchema,
        outputSchema: {},
        graph: [
          {
            type: 'parallel',
            steps: [
              { type: 'tool', id: 'lookup-a', toolId: 'lookupCustomer' },
              { type: 'tool', id: 'lookup-b', toolId: 'lookupCustomer' },
            ],
          },
        ],
      });

      const inspection = inspectWorkflowBuilderSchemas(definition, {
        tools: { lookupCustomer: { inputSchema, outputSchema: lookupOutputSchema } },
      });

      expect([...inspection.stepOutputs.keys()]).toEqual(['lookup-a', 'lookup-b']);
      expect(inspection.stepOutputs.get('lookup-a')).toEqual(lookupOutputSchema);
      expect(compareWorkflowBuilderSchemas(lookupOutputSchema, inputSchema)).toBe('incompatible');
      expect(compareWorkflowBuilderSchemas(undefined, inputSchema)).toBe('unknown');
    });
  });
});
