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
  ensureProjectSandbox,
  isSandboxEnabled,
  materializeRepo,
  MaterializeError,
  resetSandboxFactory,
  setSandboxFactory,
} from './sandbox';
import type { MaterializationSandbox, SandboxCommandResult } from './sandbox';
import type { GithubProjectRow } from './schema';

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

function makeRow(overrides: Partial<GithubProjectRow> = {}): GithubProjectRow {
  return {
    id: 'proj-1',
    userId: 'user-1',
    installationId: 42,
    repoFullName: 'octocat/hello',
    repoId: 99,
    defaultBranch: 'main',
    sandboxProvider: 'railway',
    sandboxId: null,
    sandboxWorkdir: '/workspace/hello',
    materializedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  dbUpdates.length = 0;
});

afterEach(() => {
  resetSandboxFactory();
  delete process.env.RAILWAY_API_TOKEN;
  delete process.env.MASTRACODE_SANDBOX_PROVIDER;
  delete process.env.MASTRACODE_SANDBOX_WORKDIR;
});

describe('isSandboxEnabled', () => {
  it('is true for railway when a token is set', () => {
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(isSandboxEnabled()).toBe(true);
  });

  it('is false without a token', () => {
    expect(isSandboxEnabled()).toBe(false);
  });

  it('is false for an unknown provider', () => {
    process.env.MASTRACODE_SANDBOX_PROVIDER = 'mystery';
    process.env.RAILWAY_API_TOKEN = 'tok';
    expect(isSandboxEnabled()).toBe(false);
  });
});

describe('computeSandboxWorkdir', () => {
  it('defaults to /workspace/<repo>', () => {
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
});

describe('materializeRepo', () => {
  it('clones on first open, scrubs the token, and marks materialized', async () => {
    const sandbox = new FakeSandbox();
    await materializeRepo(makeRow({ materializedAt: null }), sandbox, 'tok-123');

    const joined = sandbox.calls.join('\n');
    expect(sandbox.calls[0]).toBe('git --version');
    expect(joined).toContain('git clone --branch');
    expect(joined).toContain('https://x-access-token:tok-123@github.com/octocat/hello.git');
    // token scrubbed afterwards
    expect(joined).toContain('remote set-url origin');
    expect(joined).toContain('https://github.com/octocat/hello.git');
    expect(sandbox.calls.some(c => c.includes('git pull'))).toBe(false);
    expect(dbUpdates.at(-1)).toHaveProperty('materializedAt');
  });

  it('pulls (not clones) on re-open', async () => {
    const sandbox = new FakeSandbox();
    await materializeRepo(makeRow({ materializedAt: new Date() }), sandbox, 'tok-xyz');

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
    await expect(materializeRepo(makeRow(), sandbox, 'tok')).rejects.toMatchObject({
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
    const err = await materializeRepo(makeRow(), sandbox, 'tok').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
  });

  it('refuses to run git when the default branch is not git-ref-safe', async () => {
    const sandbox = new FakeSandbox();
    const err = await materializeRepo(makeRow({ defaultBranch: "main'; rm -rf /; '" }), sandbox, 'tok').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    // No git command should have been executed for an invalid branch.
    expect(sandbox.calls).toHaveLength(0);
  });

  it('refuses to run git when the repo full name is not owner/name shaped', async () => {
    const sandbox = new FakeSandbox();
    const err = await materializeRepo(makeRow({ repoFullName: 'evil; whoami' }), sandbox, 'tok').catch(e => e);
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

    const err = await materializeRepo(makeRow({ materializedAt: new Date() }), sandbox, 'tok-secret').catch(e => e);

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

    const err = await materializeRepo(makeRow({ materializedAt: new Date() }), sandbox, 'tok').catch(e => e);
    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pull-failed');
    expect(String(err.message)).toContain('scrub');
  });
});
