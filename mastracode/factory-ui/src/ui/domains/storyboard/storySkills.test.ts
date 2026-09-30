import { describe, expect, it } from 'vitest';

import { stepSkills } from './storySkills';

const names = (skills: { name: string }[]) => skills.map(skill => skill.name);

describe('step skills', () => {
  it('inherits the lane skills unless the step loads its own, and never loads any for tools', () => {
    expect(names(stepSkills({ kind: 'agent', title: 'Review the diff' }, 'review'))).toContain('factory-review');
    expect(names(stepSkills({ kind: 'agent', title: 'Check', skills: ['changeset'] }, 'review'))).toEqual([
      'changeset',
    ]);
    expect(stepSkills({ kind: 'tool', title: 'Run CI' }, 'review')).toEqual([]);
  });
});
