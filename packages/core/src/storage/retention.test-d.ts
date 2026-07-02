import { describe, expectTypeOf, it } from 'vitest';
import type { MastraCompositeStoreConfig } from './base';
import type { RetentionConfig, RetentionTableKey } from './retention';

/**
 * The retention config is fully typed to real domain keys (`StorageDomains`)
 * and each domain's real table keys. Unknown domain/table = compile error.
 *
 * Note: the "unknown key = compile error" guarantee is enforced by TypeScript's
 * excess-property check on fresh object literals assigned to `RetentionConfig`
 * (see the `@ts-expect-error` cases below), not by structural `extends` — a
 * `Partial<Record<never, T>>` is structurally `{}` and would accept extra props
 * under a bare `extends` check. The literal-assignment cases model how users
 * actually write the config.
 */
describe('RetentionConfig typing', () => {
  it('resolves per-domain table keys from the domain descriptor', () => {
    expectTypeOf<RetentionTableKey<'memory'>>().toEqualTypeOf<'threads' | 'messages' | 'resources'>();
    expectTypeOf<RetentionTableKey<'observability'>>().toEqualTypeOf<'spans' | 'traces'>();
    expectTypeOf<RetentionTableKey<'threadState'>>().toEqualTypeOf<'threadState'>();
    expectTypeOf<RetentionTableKey<'workflows'>>().toEqualTypeOf<'workflowSnapshot'>();
    expectTypeOf<RetentionTableKey<'backgroundTasks'>>().toEqualTypeOf<'backgroundTasks'>();
    expectTypeOf<RetentionTableKey<'experiments'>>().toEqualTypeOf<'experiments'>();
    expectTypeOf<RetentionTableKey<'schedules'>>().toEqualTypeOf<'triggers'>();
  });

  it('resolves to never for authored/config domains (not growth tables)', () => {
    // Authored artifacts and config are excluded from retention by design.
    expectTypeOf<RetentionTableKey<'agents'>>().toEqualTypeOf<never>();
    expectTypeOf<RetentionTableKey<'skills'>>().toEqualTypeOf<never>();
    expectTypeOf<RetentionTableKey<'datasets'>>().toEqualTypeOf<never>();
    expectTypeOf<RetentionTableKey<'channels'>>().toEqualTypeOf<never>();
  });

  it('is exposed on MastraCompositeStoreConfig as optional retention', () => {
    expectTypeOf<MastraCompositeStoreConfig['retention']>().toEqualTypeOf<RetentionConfig | undefined>();
  });

  it('accepts known domain + table keys with policies', () => {
    const ok: RetentionConfig = {
      memory: {
        messages: { maxAge: '30d' },
        threads: { maxAge: 604800000, batchSize: 500 },
      },
      observability: {
        spans: { maxAge: '7d' },
      },
    };
    void ok;
  });

  it('rejects unknown table keys under a known domain', () => {
    const bad: RetentionConfig = {
      memory: {
        // @ts-expect-error `bogus` is not a memory retention table key
        bogus: { maxAge: '1d' },
      },
    };
    void bad;
  });

  it('rejects tables with no timestamp anchor (not age-prunable)', () => {
    const badMemory: RetentionConfig = {
      memory: {
        // @ts-expect-error observational_memory has no createdAt anchor, so it is not retention-eligible
        observationalMemory: { maxAge: '30d' },
      },
    };
    void badMemory;
  });

  it('rejects unknown domain keys', () => {
    const bad: RetentionConfig = {
      // @ts-expect-error `bogusDomain` is not a storage domain
      bogusDomain: { anything: { maxAge: '1d' } },
    };
    void bad;
  });

  it('types a domain with no retention tables as an empty policy map', () => {
    // Authored/config domains absent from DomainRetentionTables resolve to
    // Partial<Record<never, ...>> = {}. A bare `{}` is accepted (nothing to
    // prune), which is the intended "keep forever" default.
    const empty: RetentionConfig = { agents: {} };
    void empty;
  });
});
