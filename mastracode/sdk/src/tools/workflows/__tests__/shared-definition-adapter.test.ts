import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import { describe, expect, it } from 'vitest';
import { workflowDefinitionInputSchema } from '../save-workflow';

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../../../test-fixtures/workflow-builder-canonical/definitions.json', import.meta.url),
    ),
    'utf8',
  ),
) as Array<{ name: string; input: unknown; expected: unknown }>;

describe('Mastra Code workflow definition adapter', () => {
  it.each(fixtures)('accepts and canonically normalizes the $name fixture', ({ input, expected }) => {
    const parsed = workflowDefinitionInputSchema.parse(input);
    expect(parsed).toEqual(expected);
    expect(parsed).toEqual(normalizeWorkflowBuilderDefinition(input));
  });

  it('rejects closure-based entries', () => {
    expect(() =>
      workflowDefinitionInputSchema.parse({
        id: 'closure-flow',
        inputSchema: {},
        outputSchema: {},
        graph: [{ type: 'mapping', id: 'map', mapConfig: () => ({}) }],
      }),
    ).toThrow();
  });
});
