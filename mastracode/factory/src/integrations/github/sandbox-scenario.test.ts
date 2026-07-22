import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MaterializationSandbox, SandboxCommandResult } from '../../sandbox/fleet';
import { createPullRequest, MaterializeError, pushBranch } from './sandbox';

type Responder = (script: string) => SandboxCommandResult;
const OK: SandboxCommandResult = { exitCode: 0, stdout: '', stderr: '' };

/**
 * Records every shell script the helper runs so the scenario can assert the
 * security invariant across the WHOLE operation, not a single command.
 */
class RecordingSandbox implements MaterializationSandbox {
  readonly id = 'logical-id';
  readonly calls: string[] = [];
  startCount = 0;
  private responder: Responder;

  constructor(responder?: Responder) {
    this.responder = responder ?? (() => OK);
  }

  async start(): Promise<void> {
    this.startCount += 1;
  }

  async getInfo() {
    return { metadata: { railwaySandboxId: 'railway-vm-123' } };
  }

  async executeCommand(command: string, args?: string[]): Promise<SandboxCommandResult> {
    const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
    this.calls.push(script);
    return this.responder(script);
  }
}

const TOKEN = 'ghs_supersecrettoken1234567890';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S4 — token leak negative scenarios on failure paths', () => {
  it('pushBranch: a failed git push still scrubs the remote and never leaves the token behind', async () => {
    // The push itself fails; the finally-scrub must still run.
    const sandbox = new RecordingSandbox(script =>
      script.includes('push -u origin') ? { exitCode: 1, stdout: '', stderr: 'rejected: non-fast-forward' } : OK,
    );

    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', TOKEN, 'octocat/hello').catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('push-failed');

    // Invariant 1: the FINAL remote rewrite restores the clean (scrubbed) URL.
    const remoteRewrites = sandbox.calls.filter(c => c.includes('remote set-url origin'));
    expect(remoteRewrites.length).toBeGreaterThanOrEqual(2);
    const finalRewrite = remoteRewrites.at(-1)!;
    expect(finalRewrite).toContain('https://github.com/octocat/hello.git');
    expect(finalRewrite).not.toContain(TOKEN);

    // Invariant 2: the token only ever appears in the tokenized-remote rewrite,
    // and NEVER survives into the last command recorded against the sandbox.
    const lastCommand = sandbox.calls.at(-1)!;
    expect(lastCommand).not.toContain(TOKEN);

    // Invariant 3: every command that carries the token is a tokenized
    // `remote set-url` — the token is never smuggled into push/config/log.
    const tokenCommands = sandbox.calls.filter(c => c.includes(TOKEN));
    expect(tokenCommands.length).toBeGreaterThan(0);
    for (const c of tokenCommands) {
      expect(c).toContain('remote set-url origin');
      expect(c).toContain(`https://x-access-token:${TOKEN}@github.com/octocat/hello.git`);
    }
  });

  it('pushBranch: an egress failure during push is classified and still scrubs the token', async () => {
    const sandbox = new RecordingSandbox(script =>
      script.includes('push -u origin')
        ? { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' }
        : OK,
    );

    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', TOKEN, 'octocat/hello').catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');

    // The scrub still runs after the egress failure.
    const finalRewrite = sandbox.calls.filter(c => c.includes('remote set-url origin')).at(-1)!;
    expect(finalRewrite).toContain('https://github.com/octocat/hello.git');
    expect(finalRewrite).not.toContain(TOKEN);
    expect(sandbox.calls.at(-1)).not.toContain(TOKEN);
  });

  it('createPullRequest: a failed gh pr create keeps GH_TOKEN inside that single invocation only', async () => {
    const sandbox = new RecordingSandbox(script => {
      if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
      if (script.includes('gh pr create')) {
        return { exitCode: 1, stdout: '', stderr: 'pull request already exists' };
      }
      return OK;
    });

    const err = await createPullRequest(sandbox, '/workspace/worktrees/feat-x', {
      token: TOKEN,
      base: 'main',
      head: 'feat/x',
      title: 'Add feature',
      body: 'body',
    }).catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('pr-failed');

    // The token may appear ONLY in the single failing `gh pr create` command,
    // as an inline env prefix — never in the preflight or any other command.
    const tokenCommands = sandbox.calls.filter(c => c.includes(TOKEN));
    expect(tokenCommands).toHaveLength(1);
    expect(tokenCommands[0]).toContain(`GH_TOKEN='${TOKEN}' gh pr create`);

    // The preflight ran but carried no token.
    const preflight = sandbox.calls.find(c => c === 'gh --version')!;
    expect(preflight).not.toContain(TOKEN);

    // Token is never exported into the session or written to git config.
    expect(sandbox.calls.some(c => c.includes('export GH_TOKEN'))).toBe(false);
    expect(sandbox.calls.some(c => c.includes('git config') && c.includes(TOKEN))).toBe(false);
  });

  it('createPullRequest: an egress failure from gh is classified without leaking the token', async () => {
    const sandbox = new RecordingSandbox(script => {
      if (script === 'gh --version') return { exitCode: 0, stdout: 'gh version 2.0.0', stderr: '' };
      if (script.includes('gh pr create')) {
        return { exitCode: 1, stdout: '', stderr: 'could not resolve host: github.com' };
      }
      return OK;
    });

    const err = await createPullRequest(sandbox, '/workspace/hello', {
      token: TOKEN,
      base: 'main',
      head: 'feat/x',
      title: 't',
    }).catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');

    const tokenCommands = sandbox.calls.filter(c => c.includes(TOKEN));
    expect(tokenCommands).toHaveLength(1);
    expect(tokenCommands[0]).toContain('gh pr create');
  });
});
