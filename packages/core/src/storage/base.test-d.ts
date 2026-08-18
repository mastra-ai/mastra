import { describe, expectTypeOf, it } from 'vitest';
import { DOMAIN_KEYS } from './base';
import type { StorageDomains } from './base';

/**
 * DOMAIN_KEYS must cover every key of StorageDomains. The exhaustiveness
 * guard in base.ts makes a missing key a compile error at the definition
 * site; these cases pin the same contract as a permanent typecheck-project
 * regression test.
 */
describe('DOMAIN_KEYS exhaustiveness', () => {
  it('covers every StorageDomains key and nothing else', () => {
    expectTypeOf<(typeof DOMAIN_KEYS)[number]>().toEqualTypeOf<keyof StorageDomains>();
    expectTypeOf<Exclude<keyof StorageDomains, (typeof DOMAIN_KEYS)[number]>>().toEqualTypeOf<never>();
  });

  it('rejects keys that are not StorageDomains members', () => {
    type DomainKey = (typeof DOMAIN_KEYS)[number];
    // @ts-expect-error - a key outside StorageDomains is not a domain key
    const bogus: DomainKey = 'notARealDomain';
    void bogus;
  });
});
