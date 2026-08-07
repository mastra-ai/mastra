/**
 * Tests for packages/core/src/vector/validation.ts
 *
 * All four exported helpers are pure validation functions used by every
 * vector store implementation in the monorepo (PG, Chroma, Pinecone, etc.).
 * They throw `MastraError` on invalid input — no I/O, no async behaviour,
 * no mocking required.
 *
 * Test strategy
 * ─────────────
 * • Each function is tested for valid inputs (no throw) and every distinct
 *   error branch (empty vectors, length mismatches, invalid values).
 * • `MastraError` shape (domain, category, id prefix, details keys) is
 *   verified so regressions in the error contract are caught early.
 * • `validateUpsert` is a thin combinator; tests confirm it delegates to
 *   both `validateUpsertInput` and (conditionally) `validateVectorValues`.
 */
import { describe, expect, it } from 'vitest';

import { MastraError } from '../error';
import { validateTopK, validateUpsert, validateUpsertInput, validateVectorValues } from './validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a caught MastraError or re-throws if it's something else. */
function catchMastraError(fn: () => void): MastraError {
  try {
    fn();
    throw new Error('Expected function to throw a MastraError but it did not');
  } catch (err) {
    if (err instanceof MastraError) return err;
    throw err;
  }
}

function expectErrorDetailsMessage(err: MastraError, pattern: RegExp): void {
  expect(err.details?.message).toEqual(expect.stringMatching(pattern));
}

const STORE = 'TEST_STORE';

// ---------------------------------------------------------------------------
// validateUpsertInput
// ---------------------------------------------------------------------------

describe('validateUpsertInput', () => {
  // --- valid inputs ---

  it('does not throw for a valid vectors array with no metadata or ids', () => {
    expect(() => validateUpsertInput(STORE, [[1, 2, 3]])).not.toThrow();
  });

  it('does not throw when metadata length matches vectors length', () => {
    expect(() =>
      validateUpsertInput(
        STORE,
        [
          [1, 2],
          [3, 4],
        ],
        [{ label: 'a' }, { label: 'b' }],
      ),
    ).not.toThrow();
  });

  it('does not throw when ids length matches vectors length', () => {
    expect(() => validateUpsertInput(STORE, [[1, 2]], undefined, ['id-1'])).not.toThrow();
  });

  it('does not throw when metadata is an empty array (treated as not provided)', () => {
    expect(() => validateUpsertInput(STORE, [[1, 2, 3]], [])).not.toThrow();
  });

  it('does not throw when ids is null', () => {
    expect(() => validateUpsertInput(STORE, [[1, 2]], undefined, null)).not.toThrow();
  });

  // --- empty / null vectors ---

  it('throws MastraError when vectors is null', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, null));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /empty/i);
  });

  it('throws MastraError when vectors is undefined', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, undefined));
    expect(err).toBeInstanceOf(MastraError);
  });

  it('throws MastraError when vectors is an empty array', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, []));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /empty/i);
  });

  it('error id contains the store name for empty vectors', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, []));
    expect(err.id).toContain(STORE);
  });

  // --- metadata length mismatch ---

  it('throws MastraError when metadata length differs from vectors length', () => {
    const err = catchMastraError(() =>
      validateUpsertInput(
        STORE,
        [
          [1, 2],
          [3, 4],
        ],
        [{ label: 'only-one' }],
      ),
    );
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /metadata/i);
  });

  it('error details message for metadata mismatch mentions length', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, [[1, 2]], [{ a: 1 }, { b: 2 }]));
    expectErrorDetailsMessage(err, /length/i);
  });

  // --- ids length mismatch ---

  it('throws MastraError when ids length differs from vectors length', () => {
    const err = catchMastraError(() =>
      validateUpsertInput(
        STORE,
        [
          [1, 2],
          [3, 4],
        ],
        undefined,
        ['only-one-id'],
      ),
    );
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /ids/i);
  });

  it('error details message for ids mismatch mentions length', () => {
    const err = catchMastraError(() => validateUpsertInput(STORE, [[1, 2]], undefined, ['id-1', 'id-2']));
    expectErrorDetailsMessage(err, /length/i);
  });
});

// ---------------------------------------------------------------------------
// validateTopK
// ---------------------------------------------------------------------------

describe('validateTopK', () => {
  // --- valid inputs ---

  it('does not throw for topK = 1', () => {
    expect(() => validateTopK(STORE, 1)).not.toThrow();
  });

  it('does not throw for topK = 100', () => {
    expect(() => validateTopK(STORE, 100)).not.toThrow();
  });

  it('does not throw for a large positive integer', () => {
    expect(() => validateTopK(STORE, 10_000)).not.toThrow();
  });

  // --- invalid inputs ---

  it('throws MastraError for topK = 0', () => {
    const err = catchMastraError(() => validateTopK(STORE, 0));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /positive integer/i);
  });

  it('throws MastraError for negative topK', () => {
    const err = catchMastraError(() => validateTopK(STORE, -5));
    expect(err).toBeInstanceOf(MastraError);
  });

  it('throws MastraError for a float topK', () => {
    const err = catchMastraError(() => validateTopK(STORE, 1.5));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /positive integer/i);
  });

  it('throws MastraError for NaN', () => {
    const err = catchMastraError(() => validateTopK(STORE, NaN));
    expect(err).toBeInstanceOf(MastraError);
  });

  it('throws MastraError for Infinity', () => {
    const err = catchMastraError(() => validateTopK(STORE, Infinity));
    expect(err).toBeInstanceOf(MastraError);
  });

  it('error id contains the store name', () => {
    const err = catchMastraError(() => validateTopK(STORE, 0));
    expect(err.id).toContain(STORE);
  });
});

// ---------------------------------------------------------------------------
// validateVectorValues
// ---------------------------------------------------------------------------

describe('validateVectorValues', () => {
  // --- valid inputs ---

  it('does not throw for a single valid vector', () => {
    expect(() => validateVectorValues(STORE, [[0.1, 0.2, 0.9]])).not.toThrow();
  });

  it('does not throw for multiple valid vectors', () => {
    expect(() =>
      validateVectorValues(STORE, [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]),
    ).not.toThrow();
  });

  it('does not throw for vectors containing 0 and negative values', () => {
    expect(() => validateVectorValues(STORE, [[-0.5, 0, 0.5]])).not.toThrow();
  });

  // --- null / undefined vector at an index ---

  it('throws MastraError when a vector at an index is null', () => {
    const vectors = [[1, 2], null] as any;
    const err = catchMastraError(() => validateVectorValues(STORE, vectors));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /null or undefined/i);
  });

  // --- invalid component values ---

  it('throws MastraError for NaN in a vector component', () => {
    const err = catchMastraError(() => validateVectorValues(STORE, [[1, NaN, 3]]));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /invalid value/i);
  });

  it('throws MastraError for Infinity in a vector component', () => {
    const err = catchMastraError(() => validateVectorValues(STORE, [[1, Infinity, 3]]));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /invalid value/i);
  });

  it('throws MastraError for -Infinity in a vector component', () => {
    const err = catchMastraError(() => validateVectorValues(STORE, [[-Infinity, 0.5]]));
    expect(err).toBeInstanceOf(MastraError);
  });

  it('throws MastraError for null component inside a vector', () => {
    const vectors = [[null, 0.5] as any as number[]];
    const err = catchMastraError(() => validateVectorValues(STORE, vectors));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /invalid value/i);
  });

  it('includes vector index in the error details', () => {
    const vectors = [
      [1, 2],
      [3, NaN],
    ] as number[][];
    const err = catchMastraError(() => validateVectorValues(STORE, vectors));
    expectErrorDetailsMessage(err, /\[1\]/);
  });

  it('includes component index in the error details', () => {
    const err = catchMastraError(() => validateVectorValues(STORE, [[1, 2, NaN]]));
    expectErrorDetailsMessage(err, /\[2\]/);
  });

  it('error id contains the store name', () => {
    const err = catchMastraError(() => validateVectorValues(STORE, [[NaN]]));
    expect(err.id).toContain(STORE);
  });
});

// ---------------------------------------------------------------------------
// validateUpsert (combinator)
// ---------------------------------------------------------------------------

describe('validateUpsert', () => {
  // --- delegates to validateUpsertInput ---

  it('throws for empty vectors (delegates to validateUpsertInput)', () => {
    expect(() => validateUpsert(STORE, [])).toThrow(MastraError);
  });

  it('throws for metadata length mismatch (delegates to validateUpsertInput)', () => {
    expect(() => validateUpsert(STORE, [[1, 2]], [{ a: 1 }, { b: 2 }])).toThrow(MastraError);
  });

  it('does not throw for valid inputs with validateValues = false (default)', () => {
    expect(() => validateUpsert(STORE, [[NaN, 0.5]])).not.toThrow();
  });

  // --- conditional validateVectorValues ---

  it('does not validate vector values when validateValues = false', () => {
    // NaN in vector should NOT throw when flag is false (default)
    expect(() => validateUpsert(STORE, [[NaN, 0.5]], undefined, undefined, false)).not.toThrow();
  });

  it('throws for NaN values when validateValues = true', () => {
    const err = catchMastraError(() => validateUpsert(STORE, [[NaN, 0.5]], undefined, undefined, true));
    expect(err).toBeInstanceOf(MastraError);
    expectErrorDetailsMessage(err, /invalid value/i);
  });

  it('throws for Infinity values when validateValues = true', () => {
    expect(() => validateUpsert(STORE, [[1, Infinity]], undefined, undefined, true)).toThrow(MastraError);
  });

  it('does not throw for valid vectors when validateValues = true', () => {
    expect(() =>
      validateUpsert(
        STORE,
        [
          [0.1, 0.9],
          [0.5, 0.5],
        ],
        undefined,
        undefined,
        true,
      ),
    ).not.toThrow();
  });

  it('validates both structure and values together when validateValues = true', () => {
    // Structure fine, but values bad
    expect(() => validateUpsert(STORE, [[1, NaN]], undefined, ['id-1'], true)).toThrow(MastraError);
  });
});
