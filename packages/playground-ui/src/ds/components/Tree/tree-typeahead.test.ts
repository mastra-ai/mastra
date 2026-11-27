import { describe, expect, it } from 'vitest';
import { findTypeaheadMatch } from './tree-typeahead';

const labels = ['README.md', 'logs', 'lib', 'Logo.svg', 'src'];

describe('findTypeaheadMatch', () => {
  it('finds the next row starting with a letter, ignoring case and wrapping', () => {
    expect(findTypeaheadMatch(labels, 0, 'l')).toBe(1);
    expect(findTypeaheadMatch(labels, 4, 'r')).toBe(0);
  });

  it('cycles through rows sharing a first letter when that letter repeats', () => {
    expect(findTypeaheadMatch(labels, 1, 'll')).toBe(2);
    expect(findTypeaheadMatch(labels, 3, 'lll')).toBe(1);
  });

  it('narrows to a longer prefix, starting from the current row', () => {
    expect(findTypeaheadMatch(labels, 1, 'lo')).toBe(1);
    expect(findTypeaheadMatch(labels, 1, 'logo')).toBe(3);
  });

  it('returns -1 when nothing matches', () => {
    expect(findTypeaheadMatch(labels, 0, 'zz')).toBe(-1);
  });
});
