import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture DB updates without a real Postgres. `getAppDb()` returns a chainable
// stub whose terminal `.where()` records the `set(...)` payload.
const dbUpdates: Array<Record<string, unknown>> = [];
vi.mock('./db', () => ({
  getAppDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          dbUpdates.push(values);
        },
      }),
    }),
  }),
}));

import {
  computeSandboxWorkdir,
  computeWorktreePath,
  configureGitIdentity,
  createPullRequest,
  ensureProjectSandbox,
  ensureWorktree,
  getSandboxIdleMinutes,
  getSandboxProvider,
  isSandboxEnabled,
  isValidGitRef,
  materializeRepo,
  MaterializeError,
  pushBranch,
  resetSandboxFactory,
  resolveGitIdentity,
  safeBranchDir,
  setSandboxFactory,
  shellQuote,
  withInstallToken,
  WorktreeError,
} from './sandbox';
import type { MaterializationSandbox, RepoMaterializeInfo, SandboxCommandResult } from './sandbox';
import type { GithubProjectSandboxRow } from './schema';

type Responder = (script: string) => SandboxCommandResult;
const OK: SandboxCommandResult = { exitCode: 0, stdout: '', stderr: '' };

class FakeSandbox implements MaterializationSandbox {
  readonly id = 'logical-id';
  readonly calls: string[] = [];
  startCount = 0;
  providerId = 'railway-vm-123';
  private responder: Responder;

  constructor(responder?: Responder) {
    this.responder = responder ?? (() => OK);
  }

  async start(): Promise<void> {
    this.startCount += 1;
  }

  async getInfo() {
    return { metadata: { railwaySandboxId: this.providerId } };
  }

  async executeCommand(command: string, args?: string[]): Promise<SandboxCommandResult> {
    const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
    this.calls.push(script);
    return this.responder(script);
  }
}

function makeRow(overrides: Partial<GithubProjectSandboxRow> = {}): GithubProjectSandboxRow {
  return {
    id: 'sbrow-1',
    githubProjectId: 'proj-1',
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

beforeEach(() => {
  dbUpdates.length = 0;
});

afterEach(() => {
  resetSandboxFactory();
  delete process.env.RAILWAY_API_TOKEN;
  delete process.env.MASTRACODE_SANDBOX_PROVIDER;
  delete process.env.MASTRACODE_SANDBOX_WORKDIR;
  delete process.env.MASTRACODE_SANDBOX_IDLE_MINUTES;
});

describe('getSandboxProvider', () => {
  it('defaults to railway when a Railway token is set', () => {
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(getSandboxProvider()).toBe('railway');
  });

  it('falls back to local when no Railway token is set', () => {
    expect(getSandboxProvider()).toBe('local');
  });

  it('honors an explicit provider override', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'railway';
    expect(getSandboxProvider()).toBe('railway');
  });
});

describe('isSandboxEnabled', () => {
  it('is true for railway when a token is set', () => {
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(isSandboxEnabled()).toBe(true);
  });

  it('is true without a token (auto-falls back to local)', () => {
    expect(isSandboxEnabled()).toBe(true);
  });

  it('is false when railway is explicitly selected without a token', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'railway';
    expect(isSandboxEnabled()).toBe(false);
  });

  it('is false for an unknown provider', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'mystery';
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(isSandboxEnabled()).toBe(false);
  });

  it('is true for the local provider without any token', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'local';
    expect(isSandboxEnabled()).toBe(true);
  });
});

describe('computeSandboxWorkdir', () => {
  it('defaults to /workspace/<repo> for the railway provider', () => {
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/workspace/hello');
  });

  it('appends the repo name to a configured base', () => {
    process.env.MASTRACODE_SANDBOX_WORKDIR = '/srv/checkouts';
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/srv/checkouts/hello');
  });

  it('does not double-append when the base already ends in the repo name', () => {
    process.env.MASTRACODE_SANDBOX_WORKDIR = '/srv/hello';
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/srv/hello');
  });

  it('checks out under the local sandbox root for the local provider', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'local';
    process.env.MASTRACODE_LOCAL_SANDBOX_ROOT = '/tmp/mc-sandboxes';
    expect(computeSandboxWorkdir('octocat/hello')).toBe('/tmp/mc-sandboxes/hello');
    delete process.env.MASTRACODE_LOCAL_SANDBOX_ROOT;
  });
});

describe('ensureProjectSandbox', () => {
  it('provisions a new sandbox and persists the provider id on first open', async () => {
    const sandbox = new FakeSandbox();
    setSandboxFactory(() => sandbox);

    const result = await ensureProjectSandbox(makeRow({ sandboxId: null }));

    expect(result).toBe(sandbox);
    expect(sandbox.startCount).toBe(1);
    expect(dbUpdates).toEqual([{ sandboxId: 'railway-vm-123' }]);
  });

  it('reattaches to the stored sandbox id without re-persisting', async () => {
    const sandbox = new FakeSandbox();
    let factoryArgs: { providerSandboxId?: string } | undefined;
    setSandboxFactory(opts => {
      factoryArgs = opts;
      return sandbox;
    });

    await ensureProjectSandbox(makeRow({ sandboxId: 'railway-vm-existing' }));

    expect(factoryArgs?.providerSandboxId).toBe('railway-vm-existing');
    expect(dbUpdates).toEqual([]);
  });

  it('passes the idle timeout to the provider on provision', async () => {
    process.env.MASTRACODE_SANDBOX_IDLE_MINUTES = '15';
    const sandbox = new FakeSandbox();
    let factoryArgs: { idleTimeoutMinutes?: number } | undefined;
    setSandboxFactory(opts => {
      factoryArgs = opts;
      return sandbox;
    });

    await ensureProjectSandbox(makeRow({ sandboxId: null }));

    expect(factoryArgs?.idleTimeoutMinutes).toBe(15);
  });

  it('re-provisions and clears the stale id when reattach to a dead sandbox fails', async () => {
    const dead = new FakeSandbox();
    dead.start = async () => {
      throw new Error('sandbox not found');
    };
    const fresh = new FakeSandbox();
    fresh.providerId = 'railway-vm-new';

    const provided: Array<string | undefined> = [];
    setSandboxFactory(opts => {
      provided.push(opts.providerSandboxId);
      return opts.providerSandboxId ? dead : fresh;
    });

    const result = await ensureProjectSandbox(makeRow({ sandboxId: 'railway-vm-dead' }));

    // First call reattaches (dead), second provisions fresh.
    expect(provided).toEqual(['railway-vm-dead', undefined]);
    expect(result).toBe(fresh);
    expect(fresh.startCount).toBe(1);
    // The stale id is cleared, then the new provider id persisted.
    expect(dbUpdates).toEqual([{ sandboxId: null }, { sandboxId: 'railway-vm-new' }]);
  });
});

describe('getSandboxIdleMinutes', () => {
  afterEach(() => {
    delete process.env.MASTRACODE_SANDBOX_IDLE_MINUTES;
  });

  it('defaults to 30 minutes when unset', () => {
    expect(getSandboxIdleMinutes()).toBe(30);
  });

  it('reads a positive integer from the env', () => {
    process.env.MASTRACODE_SANDBOX_IDLE_MINUTES = '45';
    expect(getSandboxIdleMinutes()).toBe(45);
  });

  it('falls back to 30 for non-positive or invalid values', () => {
    process.env.MASTRACODE_SANDBOX_IDLE_MINUTES = '0';
    expect(getSandboxIdleMinutes()).toBe(30);
    process.env.MASTRACODE_SANDBOX_IDLE_MINUTES = 'nope';
    expect(getSandboxIdleMinutes()).toBe(30);
  });
});

describe('materializeRepo', () => {
  it('clones on first open, scrubs the token, and marks materialized', async () => {
    const sandbox = new FakeSandbox();
    await materializeRepo(makeRow({ materializedAt: null }), makeRepoInfo(), sandbox, 'tok-123');

    const joined = sandbox.calls.join('\n');
    expect(sandbox.calls[0]).toBe('git --version');
    expect(joined).toContain('git clone --depth=1 --single-branch --branch');
    expect(joined).toContain('https://x-access-token:tok-123@github.com/octocat/hello.git');
    // token scrubbed afterwards
    expect(joined).toContain('remote set-url origin');
    expect(joined).toContain('https://github.com/octocat/hello.git');
    expect(sandbox.calls.some(c => c.includes('git pull'))).toBe(false);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('pulls (not clones) on re-open', async () => {
    const sandbox = new FakeSandbox();
    await materializeRepo(makeRow({ materializedAt: new Date() }), makeRepoInfo(), sandbox, 'tok-xyz');

    const joined = sandbox.calls.join('\n');
    expect(joined).toContain('git -C ');
    expect(joined).toContain('pull --ff-only');
    expect(sandbox.calls.some(c => c.includes('git clone'))).toBe(false);
    expect(joined).toContain('https://x-access-token:tok-xyz@github.com/octocat/hello.git');
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

  it('scrubs the tokenized remote even when the pull fails on re-open', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script === 'git --version') return OK;
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

describe('safeBranchDir', () => {
  it('leaves already-safe names untouched', () => {
    expect(safeBranchDir('main')).toBe('main');
    expect(safeBranchDir('release-1.2.3')).toBe('release-1.2.3');
  });

  it('collapses slashes and unsafe chars and appends a hash to stay unique', () => {
    expect(safeBranchDir('feat/cloud-agent')).toBe('feat-cloud-agent-53bf6e98');
    expect(safeBranchDir('release/1.2.3')).toBe('release-1.2.3-88ded651');
  });

  it('never produces an empty segment', () => {
    expect(safeBranchDir('///')).toBe('work-732c4e97');
  });

  it('gives ambiguous branches distinct directories', () => {
    // Without the hash suffix both of these would collapse to `feat-a`.
    expect(safeBranchDir('feat/a')).not.toBe(safeBranchDir('feat-a'));
  });
});

describe('computeWorktreePath', () => {
  it('places worktrees in a sibling worktrees/ dir of the repo checkout', () => {
    expect(computeWorktreePath('/workspace/hello', 'feat/x')).toBe('/workspace/worktrees/feat-x-79b4cc55');
  });

  it('tolerates a trailing slash on the repo workdir', () => {
    expect(computeWorktreePath('/workspace/hello/', 'main')).toBe('/workspace/worktrees/main');
  });
});

describe('ensureWorktree', () => {
  // The default FakeSandbox responder returns OK for everything, which would
  // make `test -e <path>/.git` look like the worktree already exists. Use a
  // responder that fails the existence check so the create path runs.
  const notExisting = (script: string): SandboxCommandResult =>
    script.startsWith('test -e') ? { exitCode: 1, stdout: '', stderr: '' } : OK;

  it('creates a branch + worktree from the base branch when none exists', async () => {
    const sandbox = new FakeSandbox(notExisting);
    const result = await ensureWorktree(sandbox, '/workspace/hello', { branch: 'feat/x', baseBranch: 'main' });

    expect(result).toEqual({
      worktreePath: '/workspace/worktrees/feat-x-79b4cc55',
      branch: 'feat/x',
      baseBranch: 'main',
      reused: false,
    });
    const joined = sandbox.calls.join('\n');
    expect(joined).toContain("git -C '/workspace/hello' fetch origin 'main'");
    expect(joined).toContain(
      "git -C '/workspace/hello' worktree add -B 'feat/x' '/workspace/worktrees/feat-x-79b4cc55' 'main'",
    );
  });

  it('reuses an existing worktree without running git worktree add', async () => {
    // Default responder => `test -e` returns OK => path exists => reuse.
    const sandbox = new FakeSandbox();
    const result = await ensureWorktree(sandbox, '/workspace/hello', { branch: 'feat/x', baseBranch: 'main' });

    expect(result.reused).toBe(true);
    expect(result.worktreePath).toBe('/workspace/worktrees/feat-x-79b4cc55');
    expect(sandbox.calls.some(c => c.includes('worktree add'))).toBe(false);
  });

  it('rejects an unsafe branch name before touching the sandbox', async () => {
    const sandbox = new FakeSandbox(notExisting);
    const err = await ensureWorktree(sandbox, '/workspace/hello', {
      branch: "x'; rm -rf /; '",
      baseBranch: 'main',
    }).catch(e => e);
    expect(err).toBeInstanceOf(WorktreeError);
    expect(err.code).toBe('invalid-branch');
    expect(sandbox.calls).toHaveLength(0);
  });

  it('rejects an unsafe base branch name', async () => {
    const sandbox = new FakeSandbox(notExisting);
    const err = await ensureWorktree(sandbox, '/workspace/hello', {
      branch: 'feat/x',
      baseBranch: 'bad branch',
    }).catch(e => e);
    expect(err).toBeInstanceOf(WorktreeError);
    expect(err.code).toBe('invalid-branch');
    expect(sandbox.calls).toHaveLength(0);
  });

  it('surfaces a worktree-failed error when git worktree add fails', async () => {
    const sandbox = new FakeSandbox(script => {
      if (script.startsWith('test -e')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.includes('worktree add')) return { exitCode: 1, stdout: '', stderr: 'fatal: branch in use' };
      return OK;
    });
    const err = await ensureWorktree(sandbox, '/workspace/hello', { branch: 'feat/x', baseBranch: 'main' }).catch(
      e => e,
    );
    expect(err).toBeInstanceOf(WorktreeError);
    expect(err.code).toBe('worktree-failed');
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
