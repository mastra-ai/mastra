import { describe, expect, it } from 'vitest';
import { skillSnapshotFieldValuesEqual } from './skill-snapshot-field-equal';

describe('skillSnapshotFieldValuesEqual', () => {
  it('treats null and undefined as equal', () => {
    expect(skillSnapshotFieldValuesEqual(null, undefined)).toBe(true);
  });

  it('ignores object key order', () => {
    expect(skillSnapshotFieldValuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('compares nested structures stably', () => {
    expect(
      skillSnapshotFieldValuesEqual(
        { tree: { root: { children: [{ path: 'a' }, { path: 'b' }] } } },
        { tree: { root: { children: [{ path: 'a' }, { path: 'b' }] } } },
      ),
    ).toBe(true);
  });

  it('treats nested missing and undefined values as equal', () => {
    expect(skillSnapshotFieldValuesEqual({ metadata: { foo: undefined } }, { metadata: {} })).toBe(true);
    expect(skillSnapshotFieldValuesEqual({ metadata: {} }, { metadata: { foo: undefined } })).toBe(true);
  });

  it('treats nested missing and null values as equal', () => {
    expect(skillSnapshotFieldValuesEqual({ metadata: { foo: null } }, { metadata: {} })).toBe(true);
  });

  it('detects real value differences', () => {
    expect(skillSnapshotFieldValuesEqual({ metadata: { foo: 'bar' } }, { metadata: { foo: 'baz' } })).toBe(false);
  });

  it('treats dates with the same timestamp as equal', () => {
    expect(skillSnapshotFieldValuesEqual(new Date('2024-01-01T00:00:00Z'), new Date('2024-01-01T00:00:00Z'))).toBe(
      true,
    );
  });

  it('treats dates with different timestamps as not equal', () => {
    expect(skillSnapshotFieldValuesEqual(new Date('2024-01-01T00:00:00Z'), new Date('2024-06-01T00:00:00Z'))).toBe(
      false,
    );
  });

  it('treats a date and a non-date as not equal', () => {
    expect(skillSnapshotFieldValuesEqual(new Date('2024-01-01T00:00:00Z'), '2024-01-01T00:00:00.000Z')).toBe(false);
    expect(skillSnapshotFieldValuesEqual(new Date('2024-01-01T00:00:00Z'), 1704067200000)).toBe(false);
  });
});
