import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  normalizeWorkflowBuilderDefinition,
  preflightWorkflowDefinition,
  WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS,
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

  it('keeps shared composition and nesting constraints available to every authoring frontend', () => {
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain(
      'previous output shape must satisfy the next input schema',
    );
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('nested workflow');
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('declarative predicate DSL');
    expect(WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS).toContain('Never invent agent, tool, or workflow IDs');
  });

  it.each(fixtures)('normalizes the $name fixture deterministically', ({ input, expected }) => {
    const normalized = normalizeWorkflowBuilderDefinition(input);
    expect(normalized).toEqual(expected);
    expect(normalizeWorkflowBuilderDefinition(normalized)).toEqual(expected);
  });

  it('rejects nested workflow call-site ids that differ from the referenced workflow id', () => {
    // Normalization only coerces shape; the rule lives in validation.
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
    // Normalization must preserve the mismatched call-site id verbatim —
    // never coerce it to workflowId — so validation can report the mismatch.
    expect((definition.graph[0] as any).steps[0]).toEqual({
      type: 'workflow',
      id: 'local-child',
      workflowId: 'shared-child',
    });
    expect(preflightWorkflowDefinition(definition)).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'invalid-nested-workflow-id',
          path: 'graph.0.steps.0.id',
          message: expect.stringContaining(
            'Nested workflow step id "local-child" must match workflowId "shared-child"',
          ),
        }),
      ],
    });
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
            steps: [{ type: 'mapping', id: 'map-child', mapConfig: JSON.stringify({ value: { value: true } }) }],
          },
        ],
      });

      expect(result).toEqual({
        ok: false,
        issues: [expect.objectContaining({ code: 'invalid-map-placement', path: 'graph.0.steps.0' })],
      });
    });
  });
});
