import type { ExecuteCommandOptions } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExecutableSandbox, SandboxCommandResult } from '../../sandbox/materialization.js';
import { createPullRequest, MaterializeError, pushBranch } from './sandbox.js';

type Responder = (script: string) => SandboxCommandResult;
const OK: SandboxCommandResult = { exitCode: 0, stdout: '', stderr: '' };

interface RecordedExecution {
  command: string;
  args: string[];
  options?: ExecuteCommandOptions;
}

/** Records every structured command so failure paths can be checked end to end. */
class RecordingSandbox implements ExecutableSandbox {
  readonly id = 'logical-id';
  readonly calls: string[] = [];
  readonly executions: RecordedExecution[] = [];
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

  async executeCommand(
    command: string,
    args: string[] = [],
    options?: ExecuteCommandOptions,
  ): Promise<SandboxCommandResult> {
    this.executions.push({ command, args: [...args], ...(options ? { options } : {}) });
    const script = command === 'sh' && args[0] === '-c' ? args[1]! : [command, ...args].join(' ');
    this.calls.push(script);
    return this.responder(script);
  }
}

const TOKEN = 'ghs_supersecrettoken1234567890';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('S4 — token leak negative scenarios on failure paths', () => {
  it('pushBranch: a failed push never exposes credentials or rewrites the remote', async () => {
    const sandbox = new RecordingSandbox(script =>
      script.includes('push -u origin') ? { exitCode: 1, stdout: '', stderr: 'rejected: non-fast-forward' } : OK,
    );

    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', TOKEN, 'octocat/hello').catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('push-failed');
    expect(sandbox.calls.join('\n')).not.toContain(TOKEN);
    expect(sandbox.calls.some(call => call.includes('remote set-url origin'))).toBe(false);

    const push = sandbox.executions.find(entry => entry.command === 'git' && entry.args.includes('push'))!;
    expect(push.args.join('\n')).not.toContain(TOKEN);
    expect(push.options?.env?.GIT_CONFIG_VALUE_0).toBe(
      'Authorization: Basic ' + Buffer.from('x-access-token:' + TOKEN, 'utf8').toString('base64'),
    );
  });

  it('pushBranch: an egress failure remains classified without exposing credentials', async () => {
    const sandbox = new RecordingSandbox(script =>
      script.includes('push -u origin')
        ? { exitCode: 128, stdout: '', stderr: 'fatal: unable to access: Could not resolve host: github.com' }
        : OK,
    );

    const err = await pushBranch(sandbox, '/workspace/hello', 'feat/x', TOKEN, 'octocat/hello').catch(e => e);

    expect(err).toBeInstanceOf(MaterializeError);
    expect(err.code).toBe('egress-blocked');
    expect(sandbox.calls.join('\n')).not.toContain(TOKEN);
    expect(sandbox.calls.some(call => call.includes('remote set-url origin'))).toBe(false);
  });

  it('createPullRequest: a failed request scopes GH_TOKEN to the gh process environment', async () => {
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
    expect(sandbox.calls.join('\n')).not.toContain(TOKEN);

    const gh = sandbox.executions.find(entry => entry.command === 'gh' && entry.args[0] === 'pr')!;
    expect(gh.options?.env).toEqual({ GH_TOKEN: TOKEN });
    expect(gh.args.join('\n')).not.toContain(TOKEN);
    const preflight = sandbox.executions.find(entry => entry.command === 'gh' && entry.args[0] === '--version')!;
    expect(preflight.options?.env).toBeUndefined();
  });

  it('createPullRequest: an egress failure is classified without putting the token in command text', async () => {
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
    expect(sandbox.calls.join('\n')).not.toContain(TOKEN);
    const gh = sandbox.executions.find(entry => entry.command === 'gh' && entry.args[0] === 'pr')!;
    expect(gh.options?.env).toEqual({ GH_TOKEN: TOKEN });
  });
});
