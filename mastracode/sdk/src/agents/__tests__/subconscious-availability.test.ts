import type { MastraVector } from '@mastra/core/vector';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MastraCodeState } from '../../schema.js';
import { hasSubconsciousTools, isSubconsciousEnabled } from '../memory.js';

const vector = {} as MastraVector;
const state = (partial: Partial<MastraCodeState>) => partial as MastraCodeState;

describe('subconscious tool availability', () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    else process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = previous;
  });

  it('requires both the opt-in flag and a vector store', () => {
    expect(isSubconsciousEnabled(vector)).toBe(true);
    expect(isSubconsciousEnabled(undefined)).toBe(false);
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    expect(isSubconsciousEnabled(vector)).toBe(false);
  });

  it('is available for local sessions and org-resolved Factory sessions', () => {
    expect(hasSubconsciousTools(vector, undefined)).toBe(true);
    expect(hasSubconsciousTools(vector, state({ projectPath: '/repo' }))).toBe(true);
    expect(hasSubconsciousTools(vector, state({ factoryProjectId: 'proj-1', factoryOrgId: 'org-1' }))).toBe(true);
  });

  it('is refused for Factory sessions whose org could not be resolved, matching the memory wiring', () => {
    expect(hasSubconsciousTools(vector, state({ factoryProjectId: 'proj-1' }))).toBe(false);
    expect(hasSubconsciousTools(vector, state({ factoryOrgUnresolved: true }))).toBe(false);
  });

  it('is never available without a vector store', () => {
    expect(hasSubconsciousTools(undefined, state({ factoryProjectId: 'proj-1', factoryOrgId: 'org-1' }))).toBe(false);
  });
});
