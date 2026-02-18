import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import type { AssertAssignable } from './type-validation';

describe('AssertAssignable', () => {
  describe('identical types', () => {
    it('resolves to true for matching primitive types', () => {
      type Result = AssertAssignable<string, string>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });

    it('resolves to true for matching object types', () => {
      type A = { name: string; age: number };
      type B = { name: string; age: number };
      type Result = AssertAssignable<A, B>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });
  });

  describe('assignable types', () => {
    it('resolves to true when source is a subtype of target', () => {
      type Narrow = { name: string; age: number; extra: boolean };
      type Wide = { name: string; age: number };
      type Result = AssertAssignable<Narrow, Wide>;
      expectTypeOf<Result>().toEqualTypeOf<true>();
    });
  });

  describe('non-assignable types', () => {
    it('resolves to never for completely different types', () => {
      type Result = AssertAssignable<string, number>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it('resolves to never for objects with different fields', () => {
      type A = { name: string };
      type B = { age: number };
      type Result = AssertAssignable<A, B>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });

    it('resolves to never for missing required fields', () => {
      type Partial = { name: string };
      type Full = { name: string; age: number };
      type Result = AssertAssignable<Partial, Full>;
      expectTypeOf<Result>().toEqualTypeOf<never>();
    });
  });

  describe('bidirectional check pattern (as used in codebase)', () => {
    it('both directions resolve to true for matching interface and z.infer', () => {
      const schema = z.object({ name: z.string(), count: z.number() });
      interface Explicit {
        name: string;
        count: number;
      }

      type Inferred = z.infer<typeof schema>;
      type ToInferred = AssertAssignable<Explicit, Inferred>;
      type FromInferred = AssertAssignable<Inferred, Explicit>;

      expectTypeOf<ToInferred>().toEqualTypeOf<true>();
      expectTypeOf<FromInferred>().toEqualTypeOf<true>();

      // The actual pattern used in production code compiles without error:
      const _check: [ToInferred, FromInferred] = [true, true];
      void _check;
    });

    it('detects when explicit interface has extra required field', () => {
      const schema = z.object({ name: z.string() });
      interface ExplicitWithExtra {
        name: string;
        extra: number;
      }

      type Inferred = z.infer<typeof schema>;
      // Explicit -> Inferred: succeeds (subtype)
      type ToInferred = AssertAssignable<ExplicitWithExtra, Inferred>;
      expectTypeOf<ToInferred>().toEqualTypeOf<true>();

      // Inferred -> Explicit: fails (missing 'extra')
      type FromInferred = AssertAssignable<Inferred, ExplicitWithExtra>;
      expectTypeOf<FromInferred>().toEqualTypeOf<never>();
    });

    it('detects when explicit interface is missing a field', () => {
      const schema = z.object({ name: z.string(), count: z.number() });
      interface ExplicitMissing {
        name: string;
      }

      type Inferred = z.infer<typeof schema>;
      // Explicit -> Inferred: fails (missing 'count')
      type ToInferred = AssertAssignable<ExplicitMissing, Inferred>;
      expectTypeOf<ToInferred>().toEqualTypeOf<never>();
    });

    it('detects when field type changes in schema', () => {
      const schema = z.object({ name: z.string(), count: z.string() });
      interface ExplicitWrongType {
        name: string;
        count: number; // schema says string
      }

      type Inferred = z.infer<typeof schema>;
      // Both directions fail due to count type mismatch
      type ToInferred = AssertAssignable<ExplicitWrongType, Inferred>;
      type FromInferred = AssertAssignable<Inferred, ExplicitWrongType>;
      expectTypeOf<ToInferred>().toEqualTypeOf<never>();
      expectTypeOf<FromInferred>().toEqualTypeOf<never>();
    });

    it('handles optional fields correctly', () => {
      const schema = z.object({
        name: z.string(),
        label: z.string().optional(),
      });
      interface Explicit {
        name: string;
        label?: string;
      }

      type Inferred = z.infer<typeof schema>;
      type ToInferred = AssertAssignable<Explicit, Inferred>;
      type FromInferred = AssertAssignable<Inferred, Explicit>;
      expectTypeOf<ToInferred>().toEqualTypeOf<true>();
      expectTypeOf<FromInferred>().toEqualTypeOf<true>();
    });

    it('handles nested objects', () => {
      const schema = z.object({
        pagination: z.object({ page: z.number(), total: z.number() }),
        items: z.array(z.object({ id: z.string() })),
      });
      interface Explicit {
        pagination: { page: number; total: number };
        items: { id: string }[];
      }

      type Inferred = z.infer<typeof schema>;
      type ToInferred = AssertAssignable<Explicit, Inferred>;
      type FromInferred = AssertAssignable<Inferred, Explicit>;
      expectTypeOf<ToInferred>().toEqualTypeOf<true>();
      expectTypeOf<FromInferred>().toEqualTypeOf<true>();
    });
  });

  describe('@ts-expect-error validation', () => {
    // These tests verify that the production pattern correctly FAILS to compile
    // when types don't match. If the @ts-expect-error is unnecessary (meaning
    // the line compiles fine), TypeScript will report an error here.
    it('production pattern fails when interface drifts from schema', () => {
      const schema = z.object({ name: z.string(), count: z.number() });
      interface Drifted {
        name: string;
        count: string; // wrong type
      }

      type Inferred = z.infer<typeof schema>;
      type ToInferred = AssertAssignable<Drifted, Inferred>;
      type FromInferred = AssertAssignable<Inferred, Drifted>;

      // @ts-expect-error - This is the actual production pattern; it must fail when types drift
      const _check: [ToInferred, FromInferred] = [true, true];
      void _check;
    });
  });
});
