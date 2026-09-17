import { describe, expectTypeOf, it } from 'vitest';

import type { VersionResolutionOptions } from '../storage/domains/versioned';

import type { VersionSelector } from './types';

describe('public version selector contract', () => {
  it('stays structurally compatible with storage resolution selectors', () => {
    expectTypeOf<VersionSelector>().toMatchTypeOf<VersionResolutionOptions>();

    expectTypeOf<Extract<VersionSelector, { versionId: string }>>().toEqualTypeOf<
      Extract<VersionResolutionOptions, { versionId: string }>
    >();
    expectTypeOf<Extract<VersionSelector, { label: string }>>().toEqualTypeOf<
      Extract<VersionResolutionOptions, { label: string }>
    >();
    expectTypeOf<Extract<VersionSelector, { status: unknown }>['status']>().toEqualTypeOf<
      Exclude<VersionResolutionOptions['status'], 'archived' | undefined>
    >();
  });
});
