import { describe, it, expect } from 'vitest';
import { resolveSkills } from './skills';

describe('resolveSkills', () => {
  it('maps each entry id to true', () => {
    expect(
      resolveSkills([
        { id: 'skill_a', name: 'A' },
        { id: 'skill_b', name: 'B' },
      ]),
    ).toEqual({ skill_a: true, skill_b: true });
  });

  it('returns an empty record for no entries', () => {
    expect(resolveSkills([])).toEqual({});
  });

  it('skips entries with an empty id', () => {
    expect(resolveSkills([{ id: '', name: 'Empty' }])).toEqual({});
  });

  it('de-duplicates repeated ids', () => {
    expect(
      resolveSkills([
        { id: 'skill_a', name: 'A' },
        { id: 'skill_a', name: 'A2' },
      ]),
    ).toEqual({ skill_a: true });
  });
});
