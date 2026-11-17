import { describe, expect, it, vi } from 'vitest';

import type { ExecutableSandbox, SandboxCommandResult } from '../../sandbox/materialization.js';
import type { PublishBranchSignedInput, SignedPublishResult } from './signed-publication.js';
import { publishBranchSigned } from './signed-publication.js';

const WORKDIR = '/workspace/app';
const BRANCH = 'session/work';
const REF = `refs/heads/${BRANCH}`;

const REMOTE_HEAD = 'a'.repeat(40);
const FIRST = 'b'.repeat(40);
const SECOND = 'c'.repeat(40);
const TIP = 'd'.repeat(40);
const SIGNED_ONE = 'e'.repeat(40);
const SIGNED_TWO = 'f'.repeat(40);
const FINAL_TREE = '1'.repeat(40);

interface FakeCommit {
  sha: string;
  /** Parent commits; two makes it a merge commit. */
  parents?: string[];
  /** Raw commit message as `git log --format=%B` prints it. */
  message: string;
  /** `git diff-tree -r -z --raw --no-commit-id` output for this commit. */
  diff: string;
}

interface RepoOptions {
  tip?: string;
  /** Symbolic HEAD; `null` means a detached checkout. */
  head?: string | null;
  /** Fail the lookup of `refs/heads/<branch>`, as an absent local branch does. */
  localBranchMissing?: boolean;
  worktrees?: string[];
  mergeBase?: boolean;
  fetchOk?: boolean;
  commits?: FakeCommit[];
  /** Commit sha -> tree sha, for `rev-parse <rev>^{tree}`. */
  trees?: Record<string, string>;
  /** Blob sha -> the base64 the sandbox prints for it. */
  contents?: Record<string, string>;
  /** Blob sha -> byte size reported by `cat-file --batch-check`. */
  sizes?: Record<string, number>;
}

/** A sandbox whose command results describe one small, linear repository. */
function makeRepo(options: RepoOptions = {}) {
  const commits = options.commits ?? [];
  const trees = options.trees ?? {};
  const contents = options.contents ?? {};
  const sizes = options.sizes ?? {};
  const head = options.head === undefined ? REF : options.head;
  const calls: string[] = [];

  const executeCommand = async (command: string, args: string[] = []): Promise<SandboxCommandResult> => {
    const script = command === 'sh' && args[0] === '-c' ? args[1]! : [command, ...args].join(' ');
    calls.push(script);
    const ok = (stdout = ''): SandboxCommandResult => ({ exitCode: 0, stdout, stderr: '' });
    const failed = (exitCode = 1): SandboxCommandResult => ({ exitCode, stdout: '', stderr: 'boom' });

    if (command === 'sh' && script.includes('cat-file --batch-check')) {
      return ok(`${hexTokens(script).map(sha => String(sizes[sha] ?? 12)).join('\n')}\n`);
    }
    if (command === 'sh' && script.includes('cat-file blob')) {
      const blob = hexTokens(script)[0]!;
      return ok(contents[blob] ?? 'aGVsbG8=');
    }

    const gitArgs = args.slice(2);
    switch (gitArgs[0]) {
      case 'rev-parse': {
        const rev = gitArgs[gitArgs.length - 1]!;
        if (rev === REF) return options.localBranchMissing ? failed() : ok(`${options.tip ?? TIP}\n`);
        if (rev.endsWith('^{tree}')) {
          const tree = trees[rev.slice(0, -'^{tree}'.length)];
          return tree ? ok(`${tree}\n`) : failed();
        }
        return failed();
      }
      case 'symbolic-ref':
        return head ? ok(`${head}\n`) : failed();
      case 'worktree':
        return ok((options.worktrees ?? []).join('\0'));
      case 'fetch':
        return (options.fetchOk ?? true) ? ok() : failed(128);
      case 'merge-base':
        return (options.mergeBase ?? true) ? ok() : failed();
      case 'rev-list':
        return ok(commits.map(commit => commit.sha).join('\n'));
      case 'log': {
        const commit = commits.find(candidate => candidate.sha === gitArgs[gitArgs.length - 1]);
        if (!commit) return failed();
        return gitArgs[2] === '--format=%P' ? ok(`${(commit.parents ?? []).join(' ')}\n`) : ok(commit.message);
      }
      case 'diff-tree': {
        const commit = commits.find(candidate => candidate.sha === gitArgs[gitArgs.length - 1]);
        return commit ? ok(commit.diff) : failed();
      }
      case 'reset':
      case 'update-ref':
        return ok();
      default:
        return failed(127);
    }
  };

  const sandbox = { id: 'sandbox-1', executeCommand } as unknown as ExecutableSandbox;
  return { sandbox, calls };
}

/** Standalone hex tokens in a command, used to read back the shas it names. */
function hexTokens(script: string): string[] {
  return script.match(/[0-9a-f]{7,40}/g) ?? [];
}

interface Harness {
  input: PublishBranchSignedInput;
  createSignedCommit: ReturnType<typeof vi.fn>;
  readRemoteHead: ReturnType<typeof vi.fn>;
  unsignedFallback: ReturnType<typeof vi.fn>;
  calls: string[];
}

function harness(options: RepoOptions & { remoteHeads?: (string | null)[] } = {}): Harness {
  const { sandbox, calls } = makeRepo(options);
  const remoteHeads = options.remoteHeads ?? [REMOTE_HEAD];
  let reads = 0;
  const readRemoteHead = vi.fn(async () => {
    const head = remoteHeads[Math.min(reads, remoteHeads.length - 1)]!;
    reads += 1;
    return head;
  });
  const createSignedCommit = vi.fn(async () => ({ sha: SIGNED_ONE }));
  const unsignedFallback = vi.fn(async () => undefined);

  return {
    calls,
    readRemoteHead,
    createSignedCommit,
    unsignedFallback,
    input: {
      sandbox,
      workdir: WORKDIR,
      branch: BRANCH,
      access: { cloneUrl: 'https://github.com/acme/repo.git', authorization: { scheme: 'bearer', token: 't0k' } },
      repoFullName: 'acme/repo',
      createSignedCommit: createSignedCommit as unknown as PublishBranchSignedInput['createSignedCommit'],
      readRemoteHead: readRemoteHead as unknown as PublishBranchSignedInput['readRemoteHead'],
      unsignedFallback: unsignedFallback as unknown as PublishBranchSignedInput['unsignedFallback'],
    },
  };
}

/** A one-commit range: `FIRST` on top of the remote head, changing one file. */
function singleCommit(overrides: Partial<FakeCommit> = {}): RepoOptions {
  return {
    commits: [
      {
        sha: FIRST,
        parents: [REMOTE_HEAD],
        message: 'feat: publish me\n\nWhy: because.\n\nCo-authored-by: Someone <someone@example.com>\n',
        diff: `:100644 100644 ${'9'.repeat(40)} ${'8'.repeat(40)} M\0file.txt\0`,
        ...overrides,
      },
    ],
    trees: { [TIP]: FINAL_TREE, [SIGNED_ONE]: FINAL_TREE },
    contents: { ['8'.repeat(40)]: 'aGVsbG8=' },
  };
}

describe('publishBranchSigned', () => {
  it('publishes each commit in order and moves the checked-out branch onto the last one', async () => {
    const twoCommits = {
      commits: [
        {
          sha: FIRST,
          parents: [REMOTE_HEAD],
          message: 'feat: one\n\nbody one\n',
          diff: `:100644 100644 ${'9'.repeat(40)} ${'8'.repeat(40)} M\0file.txt\0`,
        },
        {
          sha: SECOND,
          parents: [FIRST],
          message: 'feat: two\n',
          diff: `:000000 100644 ${'0'.repeat(40)} ${'7'.repeat(40)} A\0added.txt\0`,
        },
      ],
      trees: { [TIP]: FINAL_TREE, [SIGNED_TWO]: FINAL_TREE },
      contents: { ['8'.repeat(40)]: 'aGVsbG8=', ['7'.repeat(40)]: 'd29ybGQ=' },
      remoteHeads: [REMOTE_HEAD, SIGNED_TWO],
    };
    const test = harness(twoCommits);
    test.createSignedCommit.mockResolvedValueOnce({ sha: SIGNED_ONE }).mockResolvedValueOnce({ sha: SIGNED_TWO });

    const result = await publishBranchSigned(test.input);

    expect(result).toEqual({ signed: true, headSha: SIGNED_TWO, reconciled: true });
    expect(test.createSignedCommit.mock.calls).toEqual([
      [
        {
          expectedHeadSha: REMOTE_HEAD,
          headline: 'feat: one',
          body: 'body one',
          additions: [{ path: 'file.txt', contents: 'aGVsbG8=' }],
          deletions: [],
        },
      ],
      [
        {
          expectedHeadSha: SIGNED_ONE,
          headline: 'feat: two',
          additions: [{ path: 'added.txt', contents: 'd29ybGQ=' }],
          deletions: [],
        },
      ],
    ]);
    expect(test.unsignedFallback).not.toHaveBeenCalled();
    expect(test.calls).toContain(`git -C ${WORKDIR} reset --soft ${SIGNED_TWO}`);
  });

  it('preserves the original commit message and its co-author trailer', async () => {
    const test = harness(singleCommit());
    test.readRemoteHead.mockResolvedValue(SIGNED_ONE);

    await publishBranchSigned(test.input);

    expect(test.createSignedCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'feat: publish me',
        body: 'Why: because.\n\nCo-authored-by: Someone <someone@example.com>',
      }),
    );
  });

  it('expresses a rename as a deletion plus an addition', async () => {
    const test = harness({
      commits: [
        {
          sha: FIRST,
          parents: [REMOTE_HEAD],
          message: 'refactor: move it\n',
          diff: `:100644 100644 ${'9'.repeat(40)} ${'8'.repeat(40)} R100\0before.txt\0after.txt\0`,
        },
      ],
      trees: { [TIP]: FINAL_TREE, [SIGNED_ONE]: FINAL_TREE },
      contents: { ['8'.repeat(40)]: 'aGVsbG8=' },
    });
    test.readRemoteHead.mockResolvedValue(SIGNED_ONE);

    expect((await publishBranchSigned(test.input)).signed).toBe(true);
    expect(test.createSignedCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        additions: [{ path: 'after.txt', contents: 'aGVsbG8=' }],
        deletions: [{ path: 'before.txt' }],
      }),
    );
  });

  it('publishes a deletion with no contents to read', async () => {
    const test = harness({
      commits: [
        {
          sha: FIRST,
          parents: [REMOTE_HEAD],
          message: 'chore: drop it\n',
          diff: `:100644 000000 ${'9'.repeat(40)} ${'0'.repeat(40)} D\0gone.txt\0`,
        },
      ],
      trees: { [TIP]: FINAL_TREE, [SIGNED_ONE]: FINAL_TREE },
    });
    test.readRemoteHead.mockResolvedValue(SIGNED_ONE);

    expect((await publishBranchSigned(test.input)).signed).toBe(true);
    expect(test.createSignedCommit).toHaveBeenCalledWith(
      expect.objectContaining({ additions: [], deletions: [{ path: 'gone.txt' }] }),
    );
  });

  it('falls back when a commit moves an executable bit the mutation cannot set', async () => {
    const test = harness(
      singleCommit({ diff: `:100644 100755 ${'9'.repeat(40)} ${'8'.repeat(40)} M\0script.sh\0` }),
    );

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'inexpressible-commit' });
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when a commit adds a symlink', async () => {
    const test = harness(
      singleCommit({ diff: `:000000 120000 ${'0'.repeat(40)} ${'8'.repeat(40)} A\0link\0` }),
    );

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: false,
      reason: 'inexpressible-commit',
    });
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when a commit adds a submodule', async () => {
    const test = harness(
      singleCommit({ diff: `:000000 160000 ${'0'.repeat(40)} ${'8'.repeat(40)} A\0vendor/dep\0` }),
    );

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: false,
      reason: 'inexpressible-commit',
    });
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back for a merge commit rather than publishing a wrong tree', async () => {
    const test = harness(singleCommit({ parents: [REMOTE_HEAD, SECOND] }));

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'inexpressible-commit' });
    expect(result.detail).toContain('merge commit');
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when one commit changes more files than the mutation accepts', async () => {
    const changes = Array.from(
      { length: 101 },
      (_, index) => `:100644 100644 ${'9'.repeat(40)} ${index.toString(16).padStart(40, '0')} M\0file-${index}.txt\0`,
    ).join('');
    const test = harness(singleCommit({ diff: changes }));

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'inexpressible-commit' });
    expect(result.detail).toContain('101 files');
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when a commit carries more content than one publication should', async () => {
    const blob = '8'.repeat(40);
    const test = harness({ ...singleCommit(), sizes: { [blob]: 7 * 1024 * 1024 } });

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'inexpressible-commit' });
    expect(result.detail).toContain('bytes of file content');
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the file contents cannot be read back as base64', async () => {
    const blob = '8'.repeat(40);
    const test = harness({ ...singleCommit(), contents: { [blob]: 'not base64!' } });

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'inexpressible-commit' });
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the remote head is not an ancestor of the local branch', async () => {
    const test = harness({ ...singleCommit(), mergeBase: false });

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: false,
      reason: 'not-fast-forward',
    });
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the branch does not exist on the remote yet', async () => {
    const test = harness({ ...singleCommit(), remoteHeads: [null] });

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: false,
      reason: 'remote-branch-missing',
    });
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back without publishing when the local branch has nothing new', async () => {
    const test = harness({ ...singleCommit(), remoteHeads: [TIP] });

    expect(await publishBranchSigned(test.input)).toMatchObject({ signed: false, reason: 'up-to-date' });
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the commit range cannot be fetched', async () => {
    const test = harness({ ...singleCommit(), fetchOk: false });

    expect(await publishBranchSigned(test.input)).toMatchObject({ signed: false, reason: 'fetch-failed' });
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the checkout has no local branch', async () => {
    const test = harness({ ...singleCommit(), localBranchMissing: true });

    expect(await publishBranchSigned(test.input)).toMatchObject({ signed: false, reason: 'no-local-branch' });
    expect(test.createSignedCommit).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('does not touch a branch that is checked out in another worktree', async () => {
    const test = harness({ ...singleCommit(), head: 'refs/heads/other', worktrees: [`branch ${REF}`] });

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: false,
      reason: 'checkout-elsewhere',
    });
    expect(test.readRemoteHead).not.toHaveBeenCalled();
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('moves a branch that is not checked out with a compare-and-swap', async () => {
    const test = harness({ ...singleCommit(), head: 'refs/heads/other', remoteHeads: [REMOTE_HEAD, SIGNED_ONE] });

    expect(await publishBranchSigned(test.input)).toEqual({ signed: true, headSha: SIGNED_ONE, reconciled: true });
    expect(test.calls).toContain(`git -C ${WORKDIR} update-ref ${REF} ${SIGNED_ONE} ${TIP}`);
    expect(test.calls).not.toContain(`git -C ${WORKDIR} reset --soft ${SIGNED_ONE}`);
  });

  it('falls back when the provider rejects the first commit and the branch did not move', async () => {
    const test = harness({ ...singleCommit(), remoteHeads: [REMOTE_HEAD, REMOTE_HEAD] });
    test.createSignedCommit.mockRejectedValue(new Error('GitHub rejected the signed commit (422).'));

    const result = await publishBranchSigned(test.input);

    expect(result).toMatchObject({ signed: false, reason: 'publication-failed' });
    expect(result.detail).toContain('422');
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('adopts a commit that landed with its response lost, then reconciles', async () => {
    // The mutation threw, but the branch moved and its tree is the tree the
    // checkout holds: the commit landed after all.
    const test = harness({
      ...singleCommit(),
      remoteHeads: [REMOTE_HEAD, SIGNED_ONE],
      trees: { [TIP]: FINAL_TREE, [SIGNED_ONE]: FINAL_TREE },
    });
    test.createSignedCommit.mockRejectedValue(new Error('GitHub did not answer the signed commit request.'));

    expect(await publishBranchSigned(test.input)).toEqual({ signed: true, headSha: SIGNED_ONE, reconciled: true });
    expect(test.unsignedFallback).not.toHaveBeenCalled();
  });

  it('refuses to fall back when the branch moved to something it cannot account for', async () => {
    const test = harness({
      ...singleCommit(),
      remoteHeads: [REMOTE_HEAD, SECOND],
      trees: { [TIP]: FINAL_TREE, [SECOND]: '2'.repeat(40) },
    });
    test.createSignedCommit.mockRejectedValue(new Error('GitHub did not answer the signed commit request.'));

    await expect(publishBranchSigned(test.input)).rejects.toThrow('nothing was recorded');
    expect(test.unsignedFallback).not.toHaveBeenCalled();
  });

  it('never publishes the rest of the range after a mid-range failure', async () => {
    const test = harness({
      commits: [
        {
          sha: FIRST,
          parents: [REMOTE_HEAD],
          message: 'feat: one\n',
          diff: `:100644 100644 ${'9'.repeat(40)} ${'8'.repeat(40)} M\0file.txt\0`,
        },
        {
          sha: SECOND,
          parents: [FIRST],
          message: 'feat: two\n',
          diff: `:000000 100644 ${'0'.repeat(40)} ${'7'.repeat(40)} A\0added.txt\0`,
        },
      ],
      trees: { [TIP]: FINAL_TREE },
      contents: { ['8'.repeat(40)]: 'aGVsbG8=', ['7'.repeat(40)]: 'd29ybGQ=' },
      remoteHeads: [REMOTE_HEAD, SIGNED_ONE],
    });
    test.createSignedCommit
      .mockResolvedValueOnce({ sha: SIGNED_ONE })
      .mockRejectedValueOnce(new Error('GitHub rejected the signed commit (422).'));

    const error = await publishBranchSigned(test.input).catch((caught: unknown) => caught as Error);

    expect((error as Error).message).toContain(`stopped after 1 of 2`);
    expect((error as Error).message).toContain(SIGNED_ONE);
    expect(test.unsignedFallback).not.toHaveBeenCalled();
    expect(test.calls).not.toContain(`git -C ${WORKDIR} reset --soft ${SIGNED_ONE}`);
  });

  it('refuses to move the local branch when the published commit carries a different tree', async () => {
    const test = harness({
      ...singleCommit(),
      remoteHeads: [REMOTE_HEAD, SIGNED_ONE],
      trees: { [TIP]: FINAL_TREE, [SIGNED_ONE]: '2'.repeat(40) },
    });

    await expect(publishBranchSigned(test.input)).rejects.toThrow('does not carry the local tree');
    expect(test.calls).not.toContain(`git -C ${WORKDIR} reset --soft ${SIGNED_ONE}`);
    expect(test.unsignedFallback).not.toHaveBeenCalled();
  });

  it('reports a branch that another writer advanced while this run was publishing', async () => {
    const test = harness({ ...singleCommit(), remoteHeads: [REMOTE_HEAD, SECOND] });

    await expect(publishBranchSigned(test.input)).rejects.toThrow('another writer may have advanced the branch');
    expect(test.unsignedFallback).not.toHaveBeenCalled();
  });

  it('reports that the local branch could not be reconciled after a successful publication', async () => {
    const test = harness({ ...singleCommit(), head: 'refs/heads/other', remoteHeads: [REMOTE_HEAD, SIGNED_ONE] });
    const sandbox = test.input.sandbox as unknown as {
      executeCommand: (command: string, args?: string[]) => Promise<SandboxCommandResult>;
    };
    const original = sandbox.executeCommand.bind(sandbox);
    sandbox.executeCommand = async (command, args = []) => {
      if (args[2] === 'update-ref') return { exitCode: 1, stdout: '', stderr: 'cannot lock ref' };
      return original(command, args);
    };

    expect(await publishBranchSigned(test.input)).toMatchObject({
      signed: true,
      headSha: SIGNED_ONE,
      reconciled: false,
      warning: expect.stringContaining('could not be moved') as unknown as string,
    });
    expect(test.unsignedFallback).not.toHaveBeenCalled();
  });

  it('rejects an invalid branch name before running any command', async () => {
    const test = harness(singleCommit());

    const result: SignedPublishResult = await publishBranchSigned({ ...test.input, branch: 'bad branch' });

    expect(result).toMatchObject({ signed: false, reason: 'invalid-branch' });
    expect(test.calls).toEqual([]);
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });

  it('falls back when the repository access carries no push credentials', async () => {
    const test = harness(singleCommit());

    const result = await publishBranchSigned({
      ...test.input,
      access: { cloneUrl: 'https://github.com/acme/repo.git' },
    });

    expect(result).toMatchObject({ signed: false, reason: 'no-credentials' });
    expect(test.unsignedFallback).toHaveBeenCalledTimes(1);
  });
});
