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

describe.each(['factory-review', 'factory-rereview'])('%s author cross-check', skill => {
  const content = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');
  const restAuthorLookup = 'gh api repos/<owner>/<repo>/pulls/<number> --jq .user.login';

  it('compares the intake author with the REST login of the exact PR, not the gh CLI author', () => {
    expect(content).toContain(`Compare \`triggeredBy\` with the PR author from \`${restAuthorLookup}\``);
    expect(content).toContain('`app/<slug>`');
    expect(content).toContain('`<slug>[bot]`');
    expect(content).not.toContain('Compare `triggeredBy` with `.author.login`');
  });

  it('still refuses to publish when the author lookup fails or the author differs', () => {
    expect(content).toContain(
      'If the lookup fails, returns no login, or the login differs from `triggeredBy`, treat it as a mismatch',
    );
    expect(content).toContain('Do not rewrite `app/<slug>` as `<slug>[bot]`');
  });

  it('checks the review token against the REST author login', () => {
    expect(content).toContain('with the PR author login from the REST lookup in the in-run cross-check');
    expect(content).not.toContain("with the PR's `.author.login`. When they match:");
  });
});

describe('factory-rereview prior-pass lookup', () => {
  const content = readFileSync(join(skillsDir, 'factory-rereview', 'SKILL.md'), 'utf8');

  it('finds its earlier review by REST login, not the gh CLI reviewer login', () => {
    expect(content).toContain(
      `gh api repos/<owner>/<repo>/pulls/<number>/reviews --paginate --jq '.[] | select(.user.login == "<factory-app>[bot]") | {state, submitted_at, body}'`,
    );
    expect(content).toContain(
      `gh api repos/<owner>/<repo>/issues/<number>/comments --paginate --jq '.[] | select(.user.login == "<factory-app>[bot]") | {created_at, body}'`,
    );
    expect(content).not.toContain('select(.author.login == "<factory-app[bot]>")');
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
