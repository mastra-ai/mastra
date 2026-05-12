import { describe, expect, it } from 'vitest';

import { stateSchema } from './schema.js';

describe('stateSchema', () => {
  it('preserves task ids in harness state', () => {
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
});
