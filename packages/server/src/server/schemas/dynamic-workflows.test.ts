import { describe, expect, it } from 'vitest';

import { dynamicWorkflowDefinitionBodySchema } from './dynamic-workflows';

const baseDefinition = {
  id: 'wire-wf',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
};

describe('dynamic workflow wire schema — control-flow entry identity fields', () => {
  it('preserves id/description/metadata on every control-flow entry instead of stripping them', () => {
    const graph = [
      {
        type: 'parallel',
        id: 'fan-out',
        description: 'Run both',
        metadata: { title: 'Fan out' },
        steps: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }],
      },
      {
        type: 'conditional',
        id: 'route',
        description: 'Route on value',
        metadata: { title: 'Route' },
        steps: [{ type: 'tool', id: 'echo-2', toolId: 'echo-tool' }],
        predicates: [{ op: 'truthy', value: { path: 'inputData.value' } }],
      },
      {
        type: 'loop',
        id: 'bump',
        description: 'Loop it',
        metadata: { title: 'Bump' },
        step: { type: 'tool', id: 'echo-3', toolId: 'echo-tool' },
        loopType: 'dountil',
        predicate: { op: 'truthy', value: { path: 'inputData.done' } },
      },
      {
        type: 'foreach',
        id: 'each',
        description: 'Per item',
        metadata: { title: 'Each' },
        step: { type: 'tool', id: 'echo-4', toolId: 'echo-tool' },
        opts: { concurrency: 2 },
      },
      { type: 'sleep', id: 'wait', description: 'Pause', metadata: { title: 'Wait' }, duration: 5 },
      { type: 'sleepUntil', id: 'hold', description: 'Hold', metadata: { title: 'Hold' }, date: '2099-01-01' },
      { type: 'mapping', id: 'shape', description: 'Reshape', metadata: { title: 'Shape' }, mapConfig: '{}' },
    ];

    const result = dynamicWorkflowDefinitionBodySchema.safeParse({ ...baseDefinition, graph });

    expect(result.success).toBe(true);
    for (const [index, entry] of graph.entries()) {
      expect(result.data!.graph[index]).toMatchObject({
        id: entry.id,
        description: entry.description,
        metadata: entry.metadata,
      });
    }
  });

  it('still accepts control-flow entries without the optional identity fields', () => {
    const result = dynamicWorkflowDefinitionBodySchema.safeParse({
      ...baseDefinition,
      graph: [
        { type: 'parallel', steps: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }] },
        { type: 'sleep', id: 'wait', duration: 5 },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data!.graph[0]).not.toHaveProperty('description');
  });
});
