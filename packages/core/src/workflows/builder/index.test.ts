import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeWorkflowBuilderDefinition, WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES } from './index';

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
});
