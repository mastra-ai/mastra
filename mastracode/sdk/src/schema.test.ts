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

  it('normalizes the HTTP null sentinel to an absent thinking override', () => {
    const parsed = stateSchema.parse({ thinkingLevel: null });

    expect(parsed.thinkingLevel).toBeUndefined();
  });

  it('preserves the factory identity keys through parse', () => {
    const parsed = stateSchema.parse({
      factoryProjectId: '2981c5b8-a843-4da0-96fb-d0a016963f04',
      factoryOrgId: 'FOdo4tqL98ibdYH8uhLXs0mZrDDE5Uiw',
    });

    expect(parsed.factoryProjectId).toBe('2981c5b8-a843-4da0-96fb-d0a016963f04');
    // The schema strips unknown keys on parse; a factoryOrgId missing from the
    // schema is silently discarded and the memory seam falls back to ownerId.
    expect(parsed.factoryOrgId).toBe('FOdo4tqL98ibdYH8uhLXs0mZrDDE5Uiw');
  });
});
