import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillsDir = join(__dirname, '..', '..', 'factory-skills');

describe.each(['factory-review', 'factory-rereview'])('%s brokered publish fallback', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('retries an author-identity verdict through the source-control broker as a comment', () => {
    expect(content).toContain('call `source_control_review_change_request`');
    expect(content).toContain(
      'retry `source_control_review_change_request` once with `event: "comment"` and the otherwise identical body',
    );
    expect(content).toContain('Verdict: approve (approval not recorded)');
    expect(content).toContain('is the only approving body the broker accepts with `event: "comment"`');
    expect(content).toContain("because Factory's stable service identity authored the PR");
    expect(content).toContain('Never use `gh pr review`, `gh pr comment`, raw provider APIs');
    expect(content).toContain('Factory routing');
  });
});

describe.each(['factory-review', 'factory-rereview'])('%s verdict ordering', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('keeps the verdict line first so the repair loop can route it', () => {
    expect(content).toContain('**must open with the verdict line**');
    expect(content).toContain('then on the next line `Reviewed head: <full 40-character SHA>`');
    expect(content).not.toContain('Prepend this line to the published body');
  });
});

describe.each(['factory-review', 'factory-rereview'])('%s GitHub App author binding', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');

  it('accepts only GitHub documented App-login aliases before the fail-closed comparison', () => {
    expect(content).toContain('REST/intake uses `<slug>[bot]`, while `gh pr view` may use `app/<slug>`');
    expect(content).toContain('replace a leading `app/` with a trailing `[bot]`');
    expect(content).toContain('make no other transformation');
    expect(content).toContain('Preserve both raw values in the session handoff');
  });
});
