// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Skill } from '../../types';
import { SkillDetail } from '../skill-detail';

afterEach(() => cleanup());

const baseSkill: Skill = {
  name: 'code-review',
  path: '.agents/skills/code-review',
  description: 'Reviews code changes for correctness and style.',
  instructions: '# Code Review\n\nUse this skill to review code changes.',
  source: { type: 'local', projectPath: '.agents/skills/code-review' },
  references: [],
  scripts: [],
  assets: [],
};

describe('SkillDetail overview', () => {
  it('shows the skills.sh install command for skills installed from skills.sh', () => {
    render(<SkillDetail skill={{ ...baseSkill, skillsShSource: { owner: 'acme', repo: 'skills' } }} />);

    expect(screen.getByText('npx skills add acme/skills/code-review')).not.toBeNull();
    expect(screen.getByText('skills.sh')).not.toBeNull();
  });

  it('omits the install command for local skills (real data only)', () => {
    render(<SkillDetail skill={baseSkill} />);

    expect(screen.queryByText(/npx skills add/)).toBeNull();
  });

  it('flags a skill with no description as invalid', () => {
    render(<SkillDetail skill={{ ...baseSkill, description: '' }} />);

    expect(screen.getByText('Invalid')).not.toBeNull();
    expect(screen.getByText('No description provided.')).not.toBeNull();
  });
});
