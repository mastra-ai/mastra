import { describe, expect, it } from 'vitest';

import { stateSchema } from './schema.js';

describe('stateSchema', () => {
  it('preserves task ids in controller state', () => {
    const parsed = stateSchema.parse({
      tasks: [
        {
          id: 'tests',
          content: 'Write tests',
          status: 'pending',
          activeForm: 'Writing tests',
        },
      ],
    });

    expect(parsed.tasks).toEqual([
      {
        id: 'tests',
        content: 'Write tests',
        status: 'pending',
        activeForm: 'Writing tests',
      },
    ]);
  });

  // Regression: the legacy controller validates its state against this schema and
  // assigns the parsed result back to state. Zod strips unknown keys, so if
  // currentModelId/modeId are not declared here, the seeded model is silently
  // discarded and the controller reports "no model selected" for every pack.
  it('preserves currentModelId through parse', () => {
    const parsed = stateSchema.parse({
      currentModelId: 'anthropic/claude-opus-4-8',
    });

    expect(parsed.currentModelId).toBe('anthropic/claude-opus-4-8');
  });

  it('preserves modeId through parse', () => {
    const parsed = stateSchema.parse({ modeId: 'build' });

    expect(parsed.modeId).toBe('build');
  });
});
