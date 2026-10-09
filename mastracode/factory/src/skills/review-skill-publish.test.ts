import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillsDir = join(__dirname, '..', '..', 'factory-skills');

describe.each(['factory-review', 'factory-rereview'])('%s publish fallback', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('publishes an author-identity verdict as a plain comment with a visible warning after the verdict line', () => {
    expect(content).toContain('gh pr comment <number> --body-file <file>');
    expect(content).toContain('**Factory misconfiguration:** the review token is the PR author');
    expect(content).toContain('Factory routing');
  });
});

describe.each(['factory-review', 'factory-rereview'])('%s verdict ordering', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('keeps the verdict line first so the repair loop can route it', () => {
    expect(content).toContain(
      'immediately after the `Reviewed head:` line (the verdict line stays first and `Reviewed head:` stays second)',
    );
    expect(content).not.toContain('Prepend this line to the published body');
  });
});
