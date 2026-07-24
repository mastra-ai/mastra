import { describe, expect, it } from 'vitest';

import { workflowInfoSchema } from './workflows';

describe('workflow serialized step-graph schema', () => {
  it('accepts declarative agent / tool / mapping step graph entries', () => {
    const result = workflowInfoSchema.safeParse({
      steps: {},
      allSteps: {},
      stepGraph: [
        { type: 'agent', id: 'writer', agentId: 'writer-agent' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
        { type: 'mapping', id: 'map-1', mapConfig: '{ value: ... }' },
        { type: 'step', id: 'plain' },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts agent / tool children nested in parallel and conditional entries', () => {
    const result = workflowInfoSchema.safeParse({
      steps: {},
      allSteps: {},
      stepGraph: [
        {
          type: 'parallel',
          steps: [
            { type: 'agent', id: 'a', agentId: 'a-agent' },
            { type: 'tool', id: 't', toolId: 't-tool' },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown step type', () => {
    const result = workflowInfoSchema.safeParse({
      steps: {},
      allSteps: {},
      stepGraph: [{ type: 'not-a-real-type', id: 'x' }],
    });

    expect(result.success).toBe(false);
  });
});
