import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillsDir = join(__dirname, '..', '..', 'factory-skills');

describe.each(['factory-review', 'factory-rereview'])('%s publish fallback', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('publishes an author-identity verdict through the broker with an explicit unrecorded-approval line', () => {
    expect(content).toContain('source_control_review_change_request');
    expect(content).toContain('Verdict: approve (approval not recorded)');
    expect(content).toContain('retry `source_control_review_change_request` once with `event: "comment"`');
    expect(content).not.toContain('gh pr comment <number> --body-file <file>');
    expect(content).toContain('Factory routing');
  });
});

describe.each(['factory-review', 'factory-rereview'])('%s verdict ordering', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('keeps the verdict line first so the repair loop can route it', () => {
    expect(content).toContain('must open with the verdict line');
    expect(content).toContain('then on the next line `Reviewed head: <full 40-character SHA>`');
    expect(content).not.toContain('Prepend this line to the published body');
  });
});
