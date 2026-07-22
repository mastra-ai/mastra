import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  normalizeWorkflowBuilderDefinition,
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
