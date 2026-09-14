import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runGit } from './runGit';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('runGit', () => {
  beforeEach(() => {
    vi.mocked(execFileSync).mockReset();
  });

  it('passes shell metacharacters as a literal argument without enabling a shell', () => {
    const branch = 'backport/evil$(touch${IFS}/tmp/mastra-pwn)-23750';

    runGit(['branch', '-D', '--', branch]);

    expect(execFileSync).toHaveBeenCalledWith('git', ['branch', '-D', '--', branch], { stdio: 'inherit' });
  });
});
