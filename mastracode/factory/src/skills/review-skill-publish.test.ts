import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillsDir = join(__dirname, '..', '..', 'factory-skills');

describe.each(['factory-review', 'factory-rereview'])('%s publish fallback', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('publishes an author-identity verdict as a comment review with a visible warning', () => {
    expect(content).toContain('gh pr review <number> --comment --body-file <file>');
    expect(content).toContain('**Factory misconfiguration:** the review token is the PR author');
    expect(content).toContain('Factory routing');
  });
});
