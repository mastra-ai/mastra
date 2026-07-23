import { describe, expect, it } from 'vitest';
import type { WorkflowRegistryIndex, WorkflowValidationInput } from './index';
import { assertValidStoredWorkflow, validateStoredWorkflow } from './index';

const emptyObjectSchema = { type: 'object', properties: {} };

function def(overrides: Partial<WorkflowValidationInput>): WorkflowValidationInput {
  return {
    id: 'wf-under-test',
    // Untyped by default so schema-flow stays 'unknown' unless a test opts in.
    inputSchema: {},
    outputSchema: {},
    graph: [],
    ...overrides,
  };
}

describe('validateStoredWorkflow', () => {
  describe('structure', () => {
    it('flags an empty graph', () => {
      expect(validateStoredWorkflow(def({ graph: [] }))).toEqual([
        expect.objectContaining({ code: 'empty-graph', path: 'graph' }),
      ]);
    });

    it('flags missing and duplicated step ids, including container children', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [
            { type: 'tool', id: 'dup', toolId: 'a' },
            { type: 'agent', id: '', agentId: 'b' },
            { type: 'parallel', steps: [{ type: 'tool', id: 'dup', toolId: 'c' }] },
          ],
        }),
      );
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'missing-step-id', path: 'graph.1.id' }),
          expect.objectContaining({ code: 'duplicate-step-id', path: 'graph.2.steps.0.id' }),
        ]),
      );
    });

    it('rejects a mapping inside a container with exactly one issue', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [
            {
              type: 'parallel',
              steps: [{ type: 'mapping', id: 'map-child', mapConfig: JSON.stringify({ value: { value: true } }) }],
            },
          ],
        }),
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'invalid-map-placement', path: 'graph.0.steps.0' })]);
    });

    it('rejects nested workflow call-site ids that differ from the workflowId', () => {
      const issues = validateStoredWorkflow(
        def({ graph: [{ type: 'workflow', id: 'local-child', workflowId: 'shared-child' }] }),
      );
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'invalid-nested-workflow-id',
          path: 'graph.0.id',
          message: expect.stringContaining('must match workflowId "shared-child"'),
        }),
      ]);
    });

    it('rejects self-referencing nested workflows even when the registry contains the id', () => {
      const issues = validateStoredWorkflow(
        def({ id: 'wf-self', graph: [{ type: 'workflow', id: 'wf-self', workflowId: 'wf-self' }] }),
        { workflows: { 'wf-self': {} } },
      );
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'self-reference',
          path: 'graph.0.workflowId',
          message: expect.stringContaining('Nested workflow cycles are not allowed'),
        }),
      ]);
    });

    it('requires declarative predicates on conditional entries and keeps them aligned', () => {
      const child = { type: 'tool', id: 't1', toolId: 'a' } as const;
      const missing = validateStoredWorkflow(def({ graph: [{ type: 'conditional', steps: [child] } as any] }));
      expect(missing).toEqual([
        expect.objectContaining({ code: 'invalid-conditional', message: expect.stringContaining('declarative') }),
      ]);

      const misaligned = validateStoredWorkflow(
        def({ graph: [{ type: 'conditional', steps: [child], predicates: [] } as any] }),
      );
      expect(misaligned).toEqual([
        expect.objectContaining({ code: 'invalid-conditional', message: expect.stringContaining('aligned') }),
      ]);

      const nullSlot = validateStoredWorkflow(
        def({ graph: [{ type: 'conditional', steps: [child], predicates: [null] } as any] }),
      );
      expect(nullSlot).toEqual([
        expect.objectContaining({ code: 'invalid-conditional', path: 'graph.0.predicates.0' }),
      ]);
    });

    it('requires a declarative predicate on loop entries', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [{ type: 'loop', step: { type: 'tool', id: 'body', toolId: 'a' }, loopType: 'dountil' } as any],
        }),
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'invalid-loop', path: 'graph.0' })]);
    });

    it('rejects non-positive foreach concurrency', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: { type: 'array', items: emptyObjectSchema },
          graph: [{ type: 'foreach', step: { type: 'tool', id: 'body', toolId: 'a' }, opts: { concurrency: 0 } }],
        }),
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'invalid-foreach', path: 'graph.0.opts.concurrency' })]);
    });
  });

  describe('schemas', () => {
    it('flags unsupported JSON Schema keywords on top-level and agent schemas', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: { oneOf: [{ type: 'string' }] },
          graph: [{ type: 'agent', id: 'a1', agentId: 'writer', outputSchema: { not: { type: 'null' } } }],
        }),
      );
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'unsupported-schema-keyword', path: 'inputSchema' }),
          expect.objectContaining({ code: 'unsupported-schema-keyword', path: 'graph.0.outputSchema' }),
        ]),
      );
    });
  });

  describe('references', () => {
    const graph = [
      { type: 'agent', id: 'a1', agentId: 'writer' },
      { type: 'tool', id: 't1', toolId: 'lookup' },
      { type: 'workflow', id: 'wf-child', workflowId: 'wf-child' },
    ] as const;

    it('skips reference checks for kinds absent from the index', () => {
      expect(validateStoredWorkflow(def({ graph: [...graph] }))).toEqual([]);
      // Only agents indexed: tool + workflow refs stay unchecked.
      expect(validateStoredWorkflow(def({ graph: [...graph] }), { agents: { writer: {} } })).toEqual([]);
    });

    it('flags unresolved references with per-kind messages', () => {
      const index: WorkflowRegistryIndex = { agents: {}, tools: {}, workflows: {} };
      const issues = validateStoredWorkflow(def({ graph: [...graph] }), index);
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'missing-reference',
          path: 'graph.0.agentId',
          message: expect.stringContaining('not a registered agent'),
        }),
        expect.objectContaining({
          code: 'missing-reference',
          path: 'graph.1.toolId',
          message: expect.stringContaining('not a registered tool'),
        }),
        expect.objectContaining({
          code: 'missing-reference',
          path: 'graph.2.workflowId',
          message: expect.stringContaining('not a registered workflow'),
        }),
      ]);
    });

    it('suggests swapping the entry type when an id is registered under the other kind', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [
            { type: 'agent', id: 'a1', agentId: 'lookup' },
            { type: 'tool', id: 't1', toolId: 'writer' },
          ],
        }),
        { agents: { writer: {} }, tools: { lookup: {} } },
      );
      expect(issues).toEqual([
        expect.objectContaining({
          message: expect.stringContaining(
            'is a registered TOOL, not an agent. Change this entry to { type: "tool", toolId: "lookup" }.',
          ),
        }),
        expect.objectContaining({
          message: expect.stringContaining(
            'is a registered AGENT, not a tool. Change this entry to { type: "agent", agentId: "writer" }.',
          ),
        }),
      ]);
    });
  });

  describe('schema flow', () => {
    const inputSchema = {
      type: 'object',
      properties: { email: { type: 'string' }, summary: { type: 'string' } },
      required: ['email', 'summary'],
    };
    const lookupTool = {
      inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      outputSchema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
    };

    it('accepts canonical mappings from init data and preceding step results', () => {
      const issues = validateStoredWorkflow(
        def({
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
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(issues).toEqual([]);
    });

    it('rejects noncanonical paths and step references that are missing or not preceding', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema,
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
        }),
      );
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'invalid-map-config', path: 'graph.0.mapConfig.summary.path' }),
          expect.objectContaining({ code: 'invalid-map-reference', path: 'graph.1.mapConfig.customerId.step' }),
          expect.objectContaining({ code: 'invalid-map-reference', path: 'graph.3.mapConfig.customerId.step' }),
        ]),
      );
    });

    it('validates template placeholders with the runtime template parser', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [
            { type: 'tool', id: 'first', toolId: 'a' },
            {
              type: 'mapping',
              id: 'templates',
              mapConfig: JSON.stringify({
                ok: { template: 'seen: ${stepResults.first}' },
                badScope: { template: 'nope: ${steps.first}' },
                unknownStep: { template: 'nope: ${stepResults.not-a-step}' },
              }),
            },
          ],
        }),
      );
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'invalid-map-reference',
          path: 'graph.1.mapConfig.badScope.template',
          message: expect.stringContaining('unknown namespace "steps"'),
        }),
        expect.objectContaining({
          code: 'invalid-map-reference',
          path: 'graph.1.mapConfig.unknownStep.template',
          message: 'Template references must use an available workflow-local source.',
        }),
      ]);
    });

    it('allows mappings and templates to reference a preceding code-step descriptor', () => {
      const issues = validateStoredWorkflow(
        def({
          graph: [
            { type: 'step', step: { id: 'code-step' } },
            {
              type: 'mapping',
              id: 'after',
              mapConfig: JSON.stringify({
                viaPath: { step: 'code-step', path: 'anything' },
                viaTemplate: { template: '${stepResults.code-step}' },
              }),
            },
          ] as any,
        }),
      );
      expect(issues).toEqual([]);
    });

    it('flags a step whose input cannot accept the preceding output', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
          graph: [{ type: 'tool', id: 't1', toolId: 'lookupCustomer' }],
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'incompatible-schema', path: 'graph.0' })]);
    });

    it('assumes agents accept { prompt } unless the registry says otherwise', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: { type: 'object', properties: { other: { type: 'string' } }, required: ['other'] },
          graph: [{ type: 'agent', id: 'a1', agentId: 'writer' }],
        }),
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'incompatible-schema', path: 'graph.0' })]);
    });

    it('checks foreach bodies against the item schema and rejects non-array input', () => {
      const arrayIn = { type: 'array', items: lookupTool.inputSchema };
      const ok = validateStoredWorkflow(
        def({
          inputSchema: arrayIn,
          outputSchema: {},
          graph: [
            { type: 'foreach', step: { type: 'tool', id: 'body', toolId: 'lookupCustomer' }, opts: { concurrency: 1 } },
          ],
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(ok).toEqual([]);

      const nonArray = validateStoredWorkflow(
        def({
          inputSchema: emptyObjectSchema,
          graph: [
            { type: 'foreach', step: { type: 'tool', id: 'body', toolId: 'lookupCustomer' }, opts: { concurrency: 1 } },
          ],
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(nonArray).toEqual([
        expect.objectContaining({
          code: 'incompatible-schema',
          path: 'graph.0',
          message: 'Foreach input must be an array.',
        }),
      ]);
    });

    it('flags loop bodies whose output cannot feed the next iteration', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: lookupTool.inputSchema,
          graph: [
            {
              type: 'loop',
              step: { type: 'tool', id: 'body', toolId: 'lookupCustomer' },
              loopType: 'dountil',
              predicate: { op: 'exists', path: 'inputData.customerId' },
            } as any,
          ],
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(issues).toEqual([
        expect.objectContaining({
          code: 'incompatible-schema',
          path: 'graph.0.step',
          message: expect.stringContaining('subsequent iteration'),
        }),
      ]);
    });

    it('validates predicate namespaces and known paths against the execution context', () => {
      const inputSchema = {
        type: 'object',
        properties: { priority: { type: 'string' } },
        required: ['priority'],
      };
      const issues = validateStoredWorkflow(
        def({
          inputSchema,
          graph: [
            {
              type: 'conditional',
              steps: [{ type: 'tool', id: 'route', toolId: 'routeTool' }],
              predicates: [
                {
                  op: 'eq',
                  left: { path: '$.priority' },
                  right: { path: 'inputData.missing' },
                },
              ],
            },
          ],
        }),
        { tools: { routeTool: { inputSchema } } },
      );

      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid-predicate-reference',
            path: 'graph.0.predicates.0.left.path',
            message: expect.stringContaining('initData, inputData, stepResults, or state'),
          }),
          expect.objectContaining({
            code: 'invalid-predicate-reference',
            path: 'graph.0.predicates.0.right.path',
            message: expect.stringContaining('does not exist'),
          }),
        ]),
      );
    });

    it('accepts predicate references to workflow input and preceding step results', () => {
      const inputSchema = {
        type: 'object',
        properties: { priority: { type: 'string' } },
        required: ['priority'],
      };
      const outputSchema = {
        type: 'object',
        properties: { customerId: { type: 'string' } },
        required: ['customerId'],
      };
      const issues = validateStoredWorkflow(
        def({
          inputSchema,
          graph: [
            { type: 'tool', id: 'lookup', toolId: 'lookupTool' },
            {
              type: 'conditional',
              steps: [{ type: 'tool', id: 'route', toolId: 'routeTool' }],
              predicates: [
                {
                  op: 'and',
                  args: [
                    { op: 'eq', left: { path: 'initData.priority' }, right: { literal: 'urgent' } },
                    { op: 'exists', path: 'stepResults.lookup.customerId' },
                  ],
                },
              ],
            },
          ],
        }),
        {
          tools: {
            lookupTool: { inputSchema, outputSchema },
            routeTool: { inputSchema: outputSchema },
          },
        },
      );

      expect(issues).toEqual([]);
    });

    it('flags a workflow output schema the final step cannot satisfy', () => {
      const issues = validateStoredWorkflow(
        def({
          inputSchema: lookupTool.inputSchema,
          outputSchema: { type: 'object', properties: { other: { type: 'string' } }, required: ['other'] },
          graph: [{ type: 'tool', id: 't1', toolId: 'lookupCustomer' }],
        }),
        { tools: { lookupCustomer: lookupTool } },
      );
      expect(issues).toEqual([expect.objectContaining({ code: 'incompatible-schema', path: 'outputSchema' })]);
    });
  });
});

describe('assertValidStoredWorkflow', () => {
  it('passes silently for a valid definition', () => {
    expect(() => assertValidStoredWorkflow(def({ graph: [{ type: 'tool', id: 't1', toolId: 'a' }] }))).not.toThrow();
  });

  it('throws one aggregate error listing every issue', () => {
    expect(() =>
      assertValidStoredWorkflow(
        def({
          id: 'wf-bad',
          graph: [
            { type: 'agent', id: 'a1', agentId: 'missing' },
            { type: 'workflow', id: 'other-id', workflowId: 'wf-child' },
          ],
        }),
        { agents: {}, workflows: {} },
      ),
    ).toThrow(
      /Stored workflow "wf-bad" failed validation with 3 issue\(s\):[\s\S]*\[invalid-nested-workflow-id\][\s\S]*\[missing-reference\] graph\.0\.agentId[\s\S]*\[missing-reference\] graph\.1\.workflowId/,
    );
  });
});
