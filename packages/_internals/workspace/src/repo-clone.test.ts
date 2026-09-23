import { describe, expect, it } from 'vitest';

import { repoCloneCommand } from './repo-clone';

describe('repoCloneCommand', () => {
  it('produces a shallow single-branch clone of the remote default branch', () => {
    expect(repoCloneCommand({ cloneUrl: 'https://github.com/acme/widgets', destination: 'widgets' })).toBe(
      `git clone --depth=1 --single-branch 'https://github.com/acme/widgets' 'widgets'`,
    );
  });

  it('pins a branch and sends the token from an env var as a per-invocation header, never in the URL', () => {
    const command = repoCloneCommand({
      cloneUrl: 'https://github.com/acme/widgets.git',
      destination: '/workspace/widgets',
      branch: 'main',
      tokenEnv: 'GH_TOKEN',
    });
    expect(command).toBe(
      `git -c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)" clone --depth=1 --single-branch --branch 'main' 'https://github.com/acme/widgets.git' '/workspace/widgets'`,
    );
    expect(command).not.toContain('x-access-token:GH_TOKEN@');
  });

  it('single-quotes every operand so shell metacharacters stay literal', () => {
    const command = repoCloneCommand({
      cloneUrl: 'https://github.com/a/b',
      destination: "dir'; rm -rf /",
      branch: 'x;y',
    });
    expect(command).toContain(`'dir'\\''; rm -rf /'`);
    expect(command).toContain(`--branch 'x;y'`);
  });
});
