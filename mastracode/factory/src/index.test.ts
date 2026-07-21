import { describe, expect, it } from 'vitest';

import { FACTORY_MODULE } from './index.js';

describe('@mastra/factory', () => {
  it('exports the module marker', () => {
    expect(FACTORY_MODULE).toBe('@mastra/factory');
  });
});
