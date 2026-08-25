import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbUpdates: Array<Record<string, unknown>> = [];

import { requireExec } from '../../sandbox/materialization.js';
import type { ExecutableSandbox, SandboxCommandResult } from '../../sandbox/materialization.js';
import { __clearSessionSandboxesForTests } from '../../sandbox/session-sandbox.js';
import type {
  ProjectRepositorySandbox,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import {
  checkoutSessionBranch,
  configureGitIdentity,
  createPullRequest,
  isValidGitRef,
  materializeRepo as materializeRepoWithStorage,
  MaterializeError,
  pushBranch,
  resolveGitIdentity,
  runSetupCommand,
  runTeardownCommand,
  shellQuote,
  withInstallToken,
  SetupCommandError,
} from './sandbox.js';
import type { RepoMaterializeInfo } from './sandbox.js';

type Responder = (script: string) => SandboxCommandResult;
const OK: SandboxCommandResult = { exitCode: 0, stdout: '', stderr: '' };

class FakeSandbox implements ExecutableSandbox {
  readonly id = 'logical-id';
  readonly calls: string[] = [];
  startCount = 0;
  providerId = 'railway-vm-123';
  private responder: Responder;

  constructor(responder?: Responder) {
    this.responder = responder ?? (() => OK);
  }

  async start(): Promise<{ outcome: 'created' | 'connected' }> {
    this.startCount += 1;
    return { outcome: this.startCount === 1 ? 'created' : 'connected' };
  }

  env: Record<string, string | undefined> = {};
  setEnv(update: (env: Record<string, string | undefined>) => Record<string, string | undefined>): void {
    this.env = { ...update({ ...this.env }) };
  }

  destroyed = false;
  async destroy(): Promise<void> {
    this.destroyed = true;
  }

  async getInfo() {
    return { metadata: { railwaySandboxId: this.providerId } };
  }

  async executeCommand(command: string, args?: string[]): Promise<SandboxCommandResult> {
    const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
    this.calls.push(script);
    // The workdir resolver probes the VM's default cwd (its home dir).
    if (script === 'pwd') return { exitCode: 0, stdout: '/home/user\n', stderr: '' };
    return this.responder(script);
  }
}

function makeRow(overrides: Partial<ProjectRepositorySandbox> = {}): ProjectRepositorySandbox {
  return {
    id: 'sbrow-1',
    projectRepositoryId: 'project-repository-1',
    userId: 'user-1',
    sandboxId: null,
    sandboxWorkdir: '/workspace/hello',
    materializedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRepoInfo(overrides: Partial<RepoMaterializeInfo> = {}): RepoMaterializeInfo {
  return { repoFullName: 'octocat/hello', defaultBranch: 'main', ...overrides };
}

const storage = {
  markMaterialized: vi.fn(async (_input: { id: string }) => {
    dbUpdates.push({ materializedAt: new Date() });
  }),
} as unknown as SourceControlStorageHandle['sessions'];

function materializeRepo(
  row: ProjectRepositorySandbox,
  repoInfo: RepoMaterializeInfo,
  sandbox: ExecutableSandbox,
  token: string,
) {
  return materializeRepoWithStorage({ row, repoInfo, sandbox, token, storage });
}

beforeEach(() => {
  dbUpdates.length = 0;
  __clearSessionSandboxesForTests();
});

describe('materializeRepo', () => {
  it('clones on first open, scrubs the token, and marks materialized', async () => {
    const sandbox = new FakeSandbox();
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-123');

    const joined = sandbox.calls.join('\n');
    expect(sandbox.calls[0]).toBe('git --version');
    expect(joined).toContain('git clone --depth=1 --single-branch --branch');
    expect(joined).toContain('https://x-access-token:tok-123@github.com/octocat/hello.git');
    expect(joined).toContain("find '/workspace/hello' -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +");
    expect(sandbox.calls).not.toContain("rm -rf '/workspace/hello'");
    // token scrubbed afterwards
    expect(joined).toContain('remote set-url origin');
    expect(joined).toContain('https://github.com/octocat/hello.git');
    expect(sandbox.calls.some(c => c.includes('git pull'))).toBe(false);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('pulls (not clones) on re-open', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok-xyz');

    const joined = sandbox.calls.join('\n');
    expect(joined).toContain('git -C ');
    expect(joined).toContain('pull --ff-only');
    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(false);
    expect(joined).toContain('https://x-access-token:tok-xyz@github.com/octocat/hello.git');
  });

  it('re-clones when the DB says materialized but the sandbox disk was wiped', async () => {
    // A platform/remote sandbox can expire and come back with an empty disk
    // while the binding row still says `materializedAt`. Trusting the row made
    // every `git -C <workdir>` fail with "cannot change to ...: No such file
    // or directory" and the workspace never recovered. Disk is the truth: no
    // checkout on disk means clone, regardless of the row.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return {
          exitCode: 128,
          stdout: '',
          stderr: "fatal: cannot change to '/workspace/hello': No such file or directory",
        };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok-abc');

    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(true);
    expect(sandbox.calls.some(c => c.includes('pull --ff-only'))).toBe(false);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('clears a non-empty workdir before cloning so a partial tree cannot wedge the workspace', async () => {
    // A checkpoint seed or a clone killed partway (crashed/OOM-killed server)
    // leaves a populated workdir with no usable checkout. `git clone` refuses
    // a non-empty destination with a non-retryable fatal, so every later
    // workspace operation failed with "destination path ... already exists and
    // is not an empty directory" until the sandbox was wiped by hand.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-abc');

    const rm = sandbox.calls.findIndex(c => c.includes('rm -rf') && c.includes('/workspace/hello'));
    const clone = sandbox.calls.findIndex(c => c.includes('git clone'));
    expect(rm).toBeGreaterThanOrEqual(0);
    expect(clone).toBeGreaterThan(rm);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('pulls (not clones) when the DB says first open but the workdir already holds this repo', async () => {
    // DB/disk drift: a fresh binding row (materializedAt null) over a workdir
    // that was already cloned by an earlier flow or before a dev DB reset.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-abc');

    const joined = sandbox.calls.join('\n');
    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(false);
    expect(joined).toContain('pull --ff-only');
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('still clones when the workdir holds a checkout of a different repo', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/someone/else.git\n', stderr: '' };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-abc');

    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(true);
    expect(sandbox.calls.some(c => c.includes('pull --ff-only'))).toBe(false);
  });

  it('detects an existing checkout even when a tokenized remote was left behind', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://x-access-token:stale@github.com/octocat/hello.git\n', stderr: '' };
      }
      return OK;
    });
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-abc');

    const joined = sandbox.calls.join('\n');
    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(false);
    expect(joined).toContain('pull --ff-only');
    // scrub still resets to the tokenless URL
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('stale');
  });

  it('throws git-missing when git is absent', async () => {
    const sandbox = new FakeSandbox(script =>
      script === 'git --version' ? { exitCode: 127, stdout: '', stderr: 'not found' } : OK,
    );
    await expect(materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok')).rejects.toMatchObject({
      code: 'git-missing',
    });
  });

  it('surfaces an egress-blocked error when github.com is unreachable', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
      if (script.includes('git clone')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' };
      }
      return OK;
    });
    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
  });

  it('surfaces the clone failure when the token scrub throws on a missing workdir', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
      if (script.includes('git clone')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' };
      }
      if (script.startsWith('test -d')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('remote set-url origin')) {
        throw new Error('Command failed with ENOENT: The "cwd" option is invalid');
      }
      return OK;
    });
    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
    expect(err.message).not.toContain('additionally');
  });

  it('reports a failed scrub when the failed clone left the checkout behind', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
      if (script.includes('git clone')) {
        return { exitCode: 128, stdout: '', stderr: 'warning: Clone succeeded, but checkout failed.' };
      }
      if (script.startsWith('test -d')) return OK;
      if (script.includes('remote set-url origin')) {
        return { exitCode: 255, stdout: '', stderr: 'error: could not lock config file .git/config' };
      }
      return OK;
    });
    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok-secret').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('clone-failed');
    expect(err.message).toMatch(/checkout failed.*Failed to scrub installation token/s);
  });

  it('surfaces a failed scrub over the pull failure once the token reached the remote', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' };
      }
      // The scrub resets to the tokenless URL; only the auth set-url carries the token.
      if (script.includes('remote set-url origin') && !script.includes('x-access-token')) {
        return { exitCode: 255, stdout: '', stderr: 'error: could not lock config file .git/config' };
      }
      return OK;
    });
    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok-secret').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
    expect(err.message).toContain('Failed to scrub installation token');
  });

  it('surfaces a throwing scrub as a token error once the token reached the remote', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' };
      }
      if (script.includes('remote set-url origin') && !script.includes('x-access-token')) {
        throw new Error('sandbox connection lost');
      }
      return OK;
    });
    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok-secret').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
    expect(err.message).toContain('Failed to scrub installation token');
    expect(err.message).toContain('sandbox connection lost');
  });

  it('refuses to run git when the default branch is not git-ref-safe', async () => {
    const sandbox = new FakeSandbox();
    const err = await materializeRepo(
      makeRow(),
      makeRepoInfo({ defaultBranch: "main'; rm -rf /; '" }),
      sandbox,
      'tok',
    ).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    // No git command should have been executed for an invalid branch.
    expect(sandbox.calls).toHaveLength(0);
  });

  it('refuses to run git when the repo full name is not owner/name shaped', async () => {
    const sandbox = new FakeSandbox();
    const err = await materializeRepo(makeRow(), makeRepoInfo({ repoFullName: 'evil; whoami' }), sandbox, 'tok').catch(
      e => e,
    );
    expect(err).toBeInstanceOf(MaterializeError);
    expect(sandbox.calls).toHaveLength(0);
  });

  it('keeps a diverged session branch on re-open instead of failing the pull', async () => {
    // The shared workdir is routinely left on a session's working branch with
    // local commits. When its upstream moved, `git pull --ff-only` aborts with
    // "Not possible to fast-forward" — that is the session's work, not an
    // error, so materialization must succeed and leave the checkout alone.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 128,
          stdout: '',
          stderr:
            "hint: Diverging branches can't be fast-forwarded, you need to either:\nfatal: Not possible to fast-forward, aborting.\n",
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok-secret');

    // No destructive recovery: never rebase, reset, or re-clone over the work.
    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard/);
    // Token scrubbed and the binding marked materialized as on any success.
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('keeps a dirty checkout as-is when local changes block the pull', async () => {
    // A previous run left uncommitted modifications in the checkout (e.g. a
    // changeset-version run or build residue); git refuses to merge over
    // them. The checkout is intact — keep it, never discard the local state.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            'error: Your local changes to the following files would be overwritten by merge:\n\tpackage.json\nPlease commit your changes or stash them before you merge.\nAborting\n',
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok-secret');

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard|stash|checkout --/);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('keeps a checkout with blocking untracked files as-is on re-open', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            'error: The following untracked working tree files would be overwritten by merge:\n\t.changeset/new-note.md\nPlease move or remove them before you merge.\nAborting\n',
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok');

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard|stash|checkout --|clean -/);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('keeps a dirty checkout as-is when pull.rebase turns the refusal into rebase wording', async () => {
    // Same dirty checkout, different git config: with `pull.rebase` set, git
    // refuses in rebase's words rather than merge's. It is still the session's
    // own uncommitted work — keep it, never discard it to force the pull.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            'error: cannot pull with rebase: Your index contains uncommitted changes.\nerror: Please commit or stash them.\n',
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok');

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard|stash|checkout --|clean -/);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('treats a session branch without an upstream as materialized on re-open', async () => {
    // Session branches are created from FETCH_HEAD and have no tracking
    // branch; `git pull` then exits with "no tracking information".
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'There is no tracking information for the current branch.\n',
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok');

    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('keeps a checkout when the upstream branch was deleted after merge', async () => {
    // Session branch was auto-deleted on the remote after its PR merged;
    // `git pull` reports the configured upstream ref is gone. The checkout
    // is intact (and the work is already integrated) — keep it as-is.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            "Your configuration specifies to merge with the ref 'refs/heads/factory/issue-1'\nfrom the remote, but no such ref was fetched.\n",
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok');

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard/);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('keeps a checkout when git cannot find the remote ref', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: "fatal: couldn't find remote ref refs/heads/factory/issue-1\n",
        };
      }
      return OK;
    });

    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok');

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toContain('git clone');
    expect(joined).not.toMatch(/rebase|reset --hard/);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('scrubs the tokenized remote even when the pull fails on re-open', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: not a fast-forward' };
      }
      return OK;
    });

    const err = await materializeRepo(
      makeRow({ materializedAt: new Date() }),
      makeRepoInfo(),
      sandbox,
      'tok-secret',
    ).catch(e => e);

    // The pull failure is surfaced...
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pull-failed');
    // ...but the token is still scrubbed back to the tokenless URL afterwards,
    // and no tokenized remote is left as the final remote state.
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
    // The repo is not marked materialized when the pull failed.
    expect(dbUpdates.some(u => 'materializedAt' in u)).toBe(false);
  });

  it('reports the pull failure first and the scrub failure alongside when both fail', async () => {
    // Regression: the scrub used to throw over the in-flight clone/pull
    // error, hiding the actionable failure behind "Failed to scrub
    // installation token". The pull failure keeps the lead — but the token
    // reached the remote, so the failed scrub is reported too, not swallowed.
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
      if (script.includes('remote get-url origin')) {
        return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
      }
      if (script.includes('pull --ff-only')) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: not a fast-forward' };
      }
      if (script.includes('remote set-url origin') && !script.includes('x-access-token')) {
        return { exitCode: 1, stdout: '', stderr: 'error: could not write config' };
      }
      return OK;
    });

    const err = await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok').catch(
      e => e,
    );
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pull-failed');
    expect(String(err.message)).toMatch(/not a fast-forward.*Failed to scrub installation token/s);
  });

  it('surfaces a scrub failure on the success path when the remote reset fails', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('remote set-url origin') && script.includes('github.com/octocat/hello.git')) {
        // The final tokenless scrub fails — the token may still be persisted.
        return { exitCode: 1, stdout: '', stderr: 'error: could not write config' };
      }
      return OK;
    });

    const err = await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok').catch(
      e => e,
    );
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pull-failed');
    expect(String(err.message)).toContain('scrub');
  });
});

describe('checkoutSessionBranch', () => {
  const opts = { branch: 'factory/pr-1', baseBranch: 'main', token: 'tok-secret', repoFullName: 'octocat/hello' };

  it('keeps the current branch when uncommitted work blocks the switch', async () => {
    // The session's agent switched branches itself (e.g. `gh pr checkout`)
    // and left uncommitted edits; git refuses to switch back over them.
    // That work must win — no error, no stash/reset to force the switch.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) {
        return { exitCode: 0, stdout: 'pr-1\n', stderr: '' };
      }
      if (script.includes('show-ref')) return OK;
      if (script.includes('checkout')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            'error: Your local changes to the following files would be overwritten by checkout:\n\tsrc/app.ts\nPlease commit your changes or stash them before you switch branches.\nAborting\n',
        };
      }
      return OK;
    });

    await expect(checkoutSessionBranch(sandbox, '/workspace/repo', opts)).resolves.toBeUndefined();

    const joined = sandbox.calls.join('\n');
    expect(joined).not.toMatch(/stash|reset --hard|checkout --|clean -/);
  });

  it('keeps the current branch when local work blocks creating the session branch', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) {
        return { exitCode: 0, stdout: 'pr-1\n', stderr: '' };
      }
      if (script.includes('show-ref')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('checkout -b')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr:
            'error: The following untracked working tree files would be overwritten by checkout:\n\tnotes.md\nPlease move or remove them before you switch branches.\nAborting\n',
        };
      }
      return OK;
    });

    await expect(checkoutSessionBranch(sandbox, '/workspace/repo', opts)).resolves.toBeUndefined();

    // Token still scrubbed back to the clean URL in the finally.
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
  });

  it('still surfaces real checkout failures', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) {
        return { exitCode: 0, stdout: 'main\n', stderr: '' };
      }
      if (script.includes('show-ref')) return OK;
      if (script.includes('checkout')) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: index file corrupt' };
      }
      return OK;
    });

    const err = await checkoutSessionBranch(sandbox, '/workspace/repo', opts).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('clone-failed');
  });

  it('adopts a branch created concurrently between the show-ref probe and checkout -b', async () => {
    // Two materializations of the same session raced: the other one created
    // the branch after this one's probe missed it. Adopt it instead of 500ing.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) return { exitCode: 0, stdout: 'main\n', stderr: '' };
      if (script.includes('show-ref')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('checkout -b') && script.includes('fetch origin')) {
        return { exitCode: 1, stdout: '', stderr: "fatal: a branch named 'factory/pr-1' already exists\n" };
      }
      return OK;
    });

    await expect(checkoutSessionBranch(sandbox, '/workspace/repo', opts)).resolves.toBeUndefined();

    const joined = sandbox.calls.join('\n');
    expect(joined).toContain("checkout 'factory/pr-1'");
    // The healthy branch is adopted as-is — no ref surgery.
    expect(joined).not.toContain('update-ref -d');
  });

  it('replaces a broken loose ref and retries the branch create', async () => {
    // A reused pooled sandbox carries a corrupt loose ref: show-ref cannot
    // resolve it, checkout -b refuses "already exists", and plain checkout
    // fails too. Drop the wedged ref and recreate the branch from FETCH_HEAD.
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) return { exitCode: 0, stdout: 'main\n', stderr: '' };
      if (script.includes('show-ref')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('fetch origin')) {
        return { exitCode: 1, stdout: '', stderr: "fatal: a branch named 'factory/pr-1' already exists\n" };
      }
      if (script.includes("checkout 'factory/pr-1'")) {
        return { exitCode: 1, stdout: '', stderr: "fatal: unable to resolve reference 'refs/heads/factory/pr-1'\n" };
      }
      return OK;
    });

    await expect(checkoutSessionBranch(sandbox, '/workspace/repo', opts)).resolves.toBeUndefined();

    const joined = sandbox.calls.join('\n');
    // `--no-deref` so a broken symref cannot redirect the delete onto another
    // branch, and the loose-ref-file fallback survives an `update-ref` refusal.
    expect(joined).toContain("update-ref --no-deref -d refs/heads/'factory/pr-1'");
    expect(joined).toMatch(/update-ref [^\n]* \|\| rm -f -- "[^\n]*\/refs\/heads\/factory\/pr-1"/);
    expect(sandbox.calls).toContain("git -C '/workspace/repo' checkout -b 'factory/pr-1' FETCH_HEAD");
    // Token still scrubbed back to the clean URL in the finally.
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
  });

  it('surfaces the collision when the wedged ref cannot be dropped', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('branch --show-current')) return { exitCode: 0, stdout: 'main\n', stderr: '' };
      if (script.includes('show-ref')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('fetch origin')) {
        return { exitCode: 1, stdout: '', stderr: "fatal: a branch named 'factory/pr-1' already exists\n" };
      }
      if (script.includes("checkout 'factory/pr-1'") || script.includes('update-ref --no-deref -d')) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: cannot lock ref\n' };
      }
      return OK;
    });

    const err = await checkoutSessionBranch(sandbox, '/workspace/repo', opts).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('clone-failed');
  });
});


describe('isValidGitRef', () => {
  it('accepts normal branch names', () => {
    expect(isValidGitRef('main')).toBe(true);
    expect(isValidGitRef('feat/cloud-agent')).toBe(true);
    expect(isValidGitRef('release-1.2.3')).toBe(true);
  });

  it('rejects empty, oversized, and shell-unsafe values', () => {
    expect(isValidGitRef('')).toBe(false);
    expect(isValidGitRef('a'.repeat(256))).toBe(false);
    expect(isValidGitRef("main'; rm -rf /; '")).toBe(false);
    expect(isValidGitRef('has space')).toBe(false);
    expect(isValidGitRef(123)).toBe(false);
  });

  it('rejects leading-dash refs that git could parse as options', () => {
    expect(isValidGitRef('--mirror')).toBe(false);
    expect(isValidGitRef('-D')).toBe(false);
  });
});

describe('shellQuote', () => {
  it('wraps simple values in single quotes', () => {
    expect(shellQuote('main')).toBe(`'main'`);
    expect(shellQuote('feat/cloud-agent')).toBe(`'feat/cloud-agent'`);
  });

  it('escapes embedded single quotes with the canonical POSIX sequence', () => {
    // A single quote must close the quoted string, emit an escaped quote, then
    // reopen — the four-character sequence '\'' — so the value cannot terminate
    // the quoted string early.
    expect(shellQuote(`it's`)).toBe(`'it'\\''s'`);
  });

  it('neutralizes command-injection attempts', () => {
    // Even if an unvalidated value (e.g. a commit message or PR body) reaches
    // the shell, the injected command stays inside a quoted literal.
    const malicious = `'; rm -rf / #`;
    const quoted = shellQuote(malicious);
    // The result is a single shell word: opening quote, escaped quotes around
    // the payload, closing quote. No unescaped quote can break out.
    expect(quoted.startsWith(`'`)).toBe(true);
    expect(quoted.endsWith(`'`)).toBe(true);
    expect(quoted).toBe(`''\\''; rm -rf / #'`);
  });
});

describe('resolveGitIdentity', () => {
  it('uses provided name and email verbatim', () => {
    expect(resolveGitIdentity({ name: 'Ada Lovelace', email: 'ada@example.com' })).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('derives a noreply identity from the login when name/email are absent', () => {
    expect(resolveGitIdentity({ login: 'octocat' })).toEqual({
      name: 'octocat',
      email: 'octocat@users.noreply.github.com',
    });
  });

  it('falls back to a stable default identity with no inputs', () => {
    expect(resolveGitIdentity({})).toEqual({
      name: 'Mastra Code',
      email: 'mastra-code@users.noreply.github.com',
    });
  });
});

describe('configureGitIdentity', () => {
  it('configures user.name and user.email in the workdir, quoted', async () => {
    const sandbox = new FakeSandbox();
    await configureGitIdentity(sandbox, '/workspace/hello', { name: 'Ada Lovelace', email: 'ada@example.com' });

    const joined = sandbox.calls.join('\n');
    expect(joined).toContain("git -C '/workspace/hello' config user.name 'Ada Lovelace'");
    expect(joined).toContain("git -C '/workspace/hello' config user.email 'ada@example.com'");
  });

  it('surfaces a commit-failed error when config fails', async () => {
    const sandbox = new FakeSandbox(script =>
      script.includes('config user.name') ? { exitCode: 1, stdout: '', stderr: 'boom' } : OK,
    );
    const err = await configureGitIdentity(sandbox, '/workspace/hello', { login: 'octocat' }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('commit-failed');
  });
});

describe('withInstallToken', () => {
  it('rewrites origin to the tokenized URL, runs fn, then scrubs the token', async () => {
    const sandbox = new FakeSandbox();
    const order: string[] = [];

    await withInstallToken(sandbox, '/workspace/hello', 'octocat/hello', 'tok-secret', async () => {
      order.push('fn');
    });

    const setUrlCalls = sandbox.calls.filter(c => c.includes('remote set-url origin'));
    // First rewrite carries the token, the final scrub restores the clean URL.
    expect(setUrlCalls[0]).toContain('https://x-access-token:tok-secret@github.com/octocat/hello.git');
    expect(setUrlCalls.at(-1)).toContain('https://github.com/octocat/hello.git');
    expect(setUrlCalls.at(-1)).not.toContain('tok-secret');
    // fn ran while the tokenized remote was set (between the two set-url calls).
    expect(order).toEqual(['fn']);
  });

  it('scrubs the token even when fn throws', async () => {
    const sandbox = new FakeSandbox();
    const err = await withInstallToken(sandbox, '/workspace/hello', 'octocat/hello', 'tok-secret', async () => {
      throw new Error('push exploded');
    }).catch(e => e);

    expect(String(err.message)).toContain('push exploded');
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
  });

  it('rethrows the error fn threw when the scrub also fails', async () => {
    const sandbox = new FakeSandbox(script =>
      script.includes('remote set-url origin') && !script.includes('x-access-token')
        ? { exitCode: 255, stdout: '', stderr: 'error: could not lock config file .git/config' }
        : OK,
    );
    const primary = new SetupCommandError('setup command failed', 'setup-failed');

    const err = await withInstallToken(sandbox, '/workspace/hello', 'octocat/hello', 'tok-secret', async () => {
      throw primary;
    }).catch(e => e);

    // Routes map SetupCommandError and MaterializeError to different responses.
    expect(err).toBe(primary);
    expect(err.code).toBe('setup-failed');
    expect(err.message).toMatch(/setup command failed.*Failed to scrub installation token/s);
  });

  it('rejects a malformed repo full name before touching the remote', async () => {
    const sandbox = new FakeSandbox();
    const err = await withInstallToken(sandbox, '/workspace/hello', 'evil; whoami', 'tok', async () => undefined).catch(
      e => e,
    );
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('push-failed');
    expect(sandbox.calls).toHaveLength(0);
  });
});

describe('pushBranch', () => {
  it('pushes the branch with -u origin using a tokenized remote, then scrubs', async () => {
    const sandbox = new FakeSandbox();
    await pushBranch(sandbox, '/workspace/hello', 'feat/cloud-agent', 'tok-secret', 'octocat/hello');

    const joined = sandbox.calls.join('\n');
    expect(joined).toContain("git -C '/workspace/hello' push -u origin 'feat/cloud-agent'");
    // tokenized remote was used during the push...
    expect(joined).toContain('https://x-access-token:tok-secret@github.com/octocat/hello.git');
    // ...and scrubbed back afterwards.
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
  });

  it('rejects an unsafe branch name before running git', async () => {
    const sandbox = new FakeSandbox();
    const err = await pushBranch(sandbox, '/workspace/hello', "x'; rm -rf /; '", 'tok', 'octocat/hello').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('push-failed');
    expect(sandbox.calls).toHaveLength(0);
  });

  it('scrubs the token even when the push itself fails', async () => {
    const sandbox = new FakeSandbox(script =>
      script.includes('push -u origin') ? { exitCode: 1, stdout: '', stderr: 'rejected' } : OK,
    );
    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', 'tok-secret', 'octocat/hello').catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('push-failed');
    const scrub = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1);
    expect(scrub).toContain('https://github.com/octocat/hello.git');
    expect(scrub).not.toContain('tok-secret');
  });

  it('keeps the push failure and its classification when the scrub also fails', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.includes('push -u origin')) {
        return { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' };
      }
      if (script.includes('remote set-url origin') && !script.includes('x-access-token')) {
        return { exitCode: 255, stdout: '', stderr: 'error: could not lock config file .git/config' };
      }
      return OK;
    });
    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', 'tok-secret', 'octocat/hello').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
    expect(err.message).toMatch(/could not reach github\.com.*Failed to scrub installation token/s);
  });

  it('classifies an egress failure during push', async () => {
    const sandbox = new FakeSandbox(script =>
      script.includes('push -u origin')
        ? { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' }
        : OK,
    );
    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', 'tok', 'octocat/hello').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
  });
});

describe('runSetupCommand', () => {
  it('runs the command inside the worktree directory', async () => {
    const sandbox = new FakeSandbox();
    await runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i && pnpm build');

    expect(sandbox.calls).toHaveLength(1);
    expect(sandbox.calls[0]).toContain("cd '/workspace/worktrees/feat-x'");
    expect(sandbox.calls[0]).toContain('pnpm i && pnpm build');
  });

  it('throws a setup-failed SetupCommandError with the command output on a non-zero exit', async () => {
    const sandbox = new FakeSandbox(() => ({ exitCode: 1, stdout: '', stderr: 'ERR_PNPM_NO_LOCKFILE' }));
    const err = await runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i').catch(e => e);

    expect(err).toBeInstanceOf(SetupCommandError);
    expect(err.code).toBe('setup-failed');
    expect(err.message).toContain('exit 1');
    expect(err.message).toContain('ERR_PNPM_NO_LOCKFILE');
  });

  it('fails with a phase-tagged timeout instead of hanging on a wedged sandbox', async () => {
    vi.useFakeTimers();
    try {
      const sandbox = new FakeSandbox();
      // A sandbox whose shell never returns must not hang the request forever.
      sandbox.executeCommand = () => new Promise<never>(() => {});
      const pending = runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i');
      const outcome = pending.catch(e => e);
      await vi.advanceTimersByTimeAsync(15 * 60_000 + 1_000);
      const err = await outcome;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('timed out');
      expect(err.message).toContain('setup command');
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards the hang-guard budget to the provider so it can kill the process', async () => {
    const sandbox = new FakeSandbox();
    const spy = vi.spyOn(sandbox, 'executeCommand');

    await runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i');

    expect(spy).toHaveBeenCalledWith('sh', ['-c', expect.any(String)], { timeout: 15 * 60_000 });
  });
});

describe('runTeardownCommand', () => {
  it('uses the same quoted workdir shell and reports bounded command output', async () => {
    const sandbox = new FakeSandbox(() => ({ exitCode: 9, stdout: '', stderr: `prefix-${'x'.repeat(3000)}` }));
    const err = await runTeardownCommand(
      sandbox,
      "/workspace/worktrees/feature's-branch",
      'pnpm local worktree teardown',
    ).catch(e => e);

    expect(sandbox.calls[0]).toContain("cd '/workspace/worktrees/feature'\\''s-branch'");
    expect(err).toBeInstanceOf(SetupCommandError);
    expect(err.code).toBe('teardown-failed');
    expect(err.message).toContain('exit 9');
    expect(err.message.length).toBeLessThan(2100);
  });

  it('times out with the teardown phase while forwarding the same provider budget', async () => {
    vi.useFakeTimers();
    try {
      const sandbox = new FakeSandbox();
      const execute = vi.fn(() => new Promise<never>(() => {}));
      sandbox.executeCommand = execute;
      const outcome = runTeardownCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm local teardown', {
        timeoutMs: 20,
      }).catch(e => e);
      await vi.advanceTimersByTimeAsync(21);

      const err = await outcome;
      expect(err.message).toContain('teardown command');
      expect(execute).toHaveBeenCalledWith('sh', ['-c', expect.any(String)], { timeout: 20 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('sh transport retry', () => {
  it('retries a transient 5xx transport error and succeeds (proxy hiccup while VM boots)', async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const sandbox = new FakeSandbox(() => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('Platform proxy request failed with 500'), { status: 500 });
        }
        return OK;
      });

      const pending = runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i');
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(sandbox.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after exhausting retries on persistent 5xx transport errors', async () => {
    vi.useFakeTimers();
    try {
      const sandbox = new FakeSandbox(() => {
        throw Object.assign(new Error('Platform proxy request failed with 500'), { status: 500 });
      });

      const pending = runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i').catch(e => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const err = await pending;

      expect(err.status).toBe(500);
      expect(sandbox.calls).toHaveLength(3); // initial + 2 retries
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry non-transient transport errors', async () => {
    const sandbox = new FakeSandbox(() => {
      throw Object.assign(new Error('Sandbox not found'), { status: 404 });
    });

    const err = await runSetupCommand(sandbox, '/workspace/worktrees/feat-x', 'pnpm i').catch(e => e);

    expect(err.status).toBe(404);
    expect(sandbox.calls).toHaveLength(1);
  });
});

describe('git transfer retry', () => {
  // A git command that reaches github.com and then loses the connection exits
  // non-zero rather than throwing, so the `sh` transport retry above never sees
  // it. One HTTP/2 hiccup used to permanently fail opening a workspace.
  const HTTP2_GLITCH = {
    exitCode: 128,
    stdout: '',
    stderr: "fatal: unable to access 'https://github.com/octocat/hello.git/': Error in the HTTP2 framing layer",
  };

  it('retries a clone that lost the connection mid-transfer and succeeds', async () => {
    vi.useFakeTimers();
    try {
      let clones = 0;
      const sandbox = new FakeSandbox(script => {
        if (script.includes('git clone')) return ++clones === 1 ? HTTP2_GLITCH : OK;
        return OK;
      });

      const pending = materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok');
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(clones).toBe(2);
      // The dead attempt leaves a partial directory that git refuses to clone
      // into, so the retry has to clear it first.
      const cloneCalls = sandbox.calls.filter(call => call.includes('git clone'));
      // Skip the pre-clone wipe that clears a dirty destination up front.
      const firstClone = sandbox.calls.indexOf(cloneCalls[0]!);
      const wipe = sandbox.calls.findIndex(
        (call, i) => i > firstClone && call.includes('-mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'),
      );
      expect(cloneCalls).toHaveLength(2);
      expect(wipe).toBeGreaterThan(firstClone);
      expect(wipe).toBeLessThan(sandbox.calls.lastIndexOf(cloneCalls[1]!));
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up and reports the clone failure once the retries are exhausted', async () => {
    vi.useFakeTimers();
    try {
      const sandbox = new FakeSandbox(script => (script.includes('git clone') ? HTTP2_GLITCH : OK));

      const pending = materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok').catch(e => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const err = await pending;

      expect(err).toBeInstanceOf(MaterializeError);
      expect(err.code).toBe('clone-failed');
      expect(sandbox.calls.filter(call => call.includes('git clone'))).toHaveLength(3); // initial + 2 retries
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a refusal, which would only fail slower', async () => {
    // Bad credentials, a missing repo, or blocked egress are settled answers:
    // the user needs them now, not in six seconds.
    const sandbox = new FakeSandbox(script =>
      script.includes('git clone')
        ? { exitCode: 128, stdout: '', stderr: 'fatal: Authentication failed for https://github.com/octocat/hello/' }
        : OK,
    );

    const err = await materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok').catch(e => e);

    expect(err.code).toBe('clone-failed');
    expect(sandbox.calls.filter(call => call.includes('git clone'))).toHaveLength(1);
  });

  it('retries a pull that lost the connection mid-transfer', async () => {
    vi.useFakeTimers();
    try {
      let pulls = 0;
      const sandbox = new FakeSandbox(script => {
        // An origin pointing at this repo sends materialize down the pull path.
        if (script.includes('remote get-url origin')) {
          return { exitCode: 0, stdout: 'https://github.com/octocat/hello.git\n', stderr: '' };
        }
        if (script.includes('pull --ff-only')) return ++pulls === 1 ? HTTP2_GLITCH : OK;
        return OK;
      });

      const pending = materializeRepo(makeRow(), makeRepoInfo(), sandbox, 'tok');
      await vi.advanceTimersByTimeAsync(2000);
      await pending;

      expect(pulls).toBe(2);
      // Nothing to clean up between pull attempts — the checkout is intact.
      expect(sandbox.calls.some(call => call.startsWith('rm -rf'))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createPullRequest', () => {
  const PR_URL = 'https://github.com/octocat/hello/pull/7';
  // gh prints the PR URL to stdout on success.
  const ghOk = (script: string): SandboxCommandResult => {
    if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
    if (script.includes('gh pr create')) return { exitCode: 0, stdout: `${PR_URL}\n`, stderr: '' };
    return OK;
  };

  it('opens a PR and parses the URL from gh stdout', async () => {
    const sandbox = new FakeSandbox(ghOk);
    const result = await createPullRequest(sandbox, '/workspace/worktrees/feat-x', {
      token: 'tok-123',
      base: 'main',
      head: 'feat/x',
      title: 'Add feature',
      body: 'Some body',
    });

    expect(result).toEqual({ url: PR_URL });
    const ghCall = sandbox.calls.find(c => c.includes('gh pr create'))!;
    expect(ghCall).toContain("cd '/workspace/worktrees/feat-x'");
    expect(ghCall).toContain("--base 'main'");
    expect(ghCall).toContain("--head 'feat/x'");
    expect(ghCall).toContain("--title 'Add feature'");
    expect(ghCall).toContain("--body 'Some body'");
  });

  it('passes GH_TOKEN only inline to the gh process, never persisted', async () => {
    const sandbox = new FakeSandbox(ghOk);
    await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok-secret',
      base: 'main',
      head: 'feat/x',
      title: 't',
    });

    const ghCall = sandbox.calls.find(c => c.includes('gh pr create'))!;
    // Token appears exactly once, as an inline env prefix on the gh command.
    expect(ghCall).toContain("GH_TOKEN='tok-secret' gh pr create");
    // It is never written via git config or exported to the session.
    expect(sandbox.calls.some(c => c.includes('export GH_TOKEN'))).toBe(false);
    expect(sandbox.calls.some(c => c.includes('git config') && c.includes('tok-secret'))).toBe(false);
  });

  it('shell-quotes a malicious title so it cannot break out', async () => {
    const sandbox = new FakeSandbox(ghOk);
    await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: "evil'; rm -rf / #",
    });
    const ghCall = sandbox.calls.find(c => c.includes('gh pr create'))!;
    expect(ghCall).toContain(`--title 'evil'\\''; rm -rf / #'`);
  });

  it('defaults body to an empty string when omitted', async () => {
    const sandbox = new FakeSandbox(ghOk);
    await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: 't',
    });
    const ghCall = sandbox.calls.find(c => c.includes('gh pr create'))!;
    expect(ghCall).toContain("--body ''");
  });

  it('surfaces an actionable gh-missing error when gh is not installed', async () => {
    const sandbox = new FakeSandbox(script =>
      script === 'gh --version' ? { exitCode: 127, stdout: '', stderr: 'gh: not found' } : OK,
    );
    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('gh-missing');
    // gh pr create must not run when the preflight fails.
    expect(sandbox.calls.some(c => c.includes('gh pr create'))).toBe(false);
  });

  it('rejects an invalid base or head branch before touching the sandbox', async () => {
    const sandbox = new FakeSandbox(ghOk);
    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'bad branch',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pr-failed');
    expect(sandbox.calls).toHaveLength(0);
  });

  it('classifies an egress failure from gh', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
      if (script.includes('gh pr create'))
        return { exitCode: 1, stdout: '', stderr: 'could not resolve host: github.com' };
      return OK;
    });
    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
  });

  it('surfaces a pr-failed error when gh exits non-zero for another reason', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
      if (script.includes('gh pr create')) return { exitCode: 1, stdout: '', stderr: 'pull request already exists' };
      return OK;
    });
    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pr-failed');
    expect(err.message).toContain('pull request already exists');
  });

  it('errors when gh succeeds but emits no PR URL', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
      if (script.includes('gh pr create')) return { exitCode: 0, stdout: 'created\n', stderr: '' };
      return OK;
    });
    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: 'tok',
      base: 'main',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pr-failed');
  });
});

describe('requireExec', () => {
  it('accepts a sandbox that can run commands', () => {
    const sandbox = new FakeSandbox();
    expect(requireExec(sandbox as unknown as WorkspaceSandbox)).toBe(sandbox);
  });

  it('names the missing capability instead of failing later inside a git helper', () => {
    // A filesystem-only provider: `executeCommand` is optional on core's
    // `WorkspaceSandbox`, so this is a legal sandbox that simply cannot serve
    // the git routes.
    const filesystemOnly = { id: 'sbx-1', provider: 'read-only-fs' } as unknown as WorkspaceSandbox;
    expect(() => requireExec(filesystemOnly)).toThrow(/'read-only-fs' does not support executeCommand/);
  });
});
