/**
 * Signed publication for GitHub-backed branches.
 *
 * The ordinary publication path commits inside the sandbox and runs `git push`,
 * which produces unsigned commits — accepted by most repositories, rejected by
 * any branch protected with "require signed commits". This module publishes the
 * very same commits through GitHub's `createCommitOnBranch` mutation instead, so
 * GitHub signs them with the App's own installation credentials and no signing
 * key ever reaches the sandbox.
 *
 * The provider owns the signing itself (`createSignedCommit`). Everything here
 * is the part that has to be identical for every caller:
 *
 *   1. plan every commit in the range and prove the mutation can express it,
 *      *before* publishing anything;
 *   2. publish one commit at a time, each expected on top of the previous one;
 *   3. reconcile the local branch, because a signed commit has a new sha.
 *
 * The mutation can only add and delete plain files. A commit that moves an
 * executable bit, writes a symlink, adds a submodule, or changes a path's type
 * is therefore not publishable this way, and a commit that has not been proved
 * publishable is never published halfway.
 *
 * Falling back to the ordinary push is allowed only while nothing has been
 * published. Once a signed commit lands, doubt is an error: the branch is never
 * force-pushed, never left mixing signed and unsigned commits, and never
 * silently rewritten.
 */

import type { RepositoryAccess } from '../../capabilities/version-control.js';
import { isValidGitRef } from '../../sandbox/git-ref.js';
import type { ExecutableSandbox } from '../../sandbox/materialization.js';
import { execute, gitAuthenticationEnvironment, sh, shellQuote } from './sandbox.js';

/** `createCommitOnBranch` rejects a commit with more file changes than this. */
const MAX_FILE_CHANGES_PER_COMMIT = 100;

/**
 * Ceiling on the content a single published commit may carry. The mutation has
 * no documented byte limit, but every file is read out of the sandbox and
 * base64-encoded (~4/3 of the raw size) to build the request, so an oversized
 * commit falls back rather than risking a timeout mid-publication.
 */
const MAX_CONTENT_BYTES_PER_COMMIT = 6 * 1024 * 1024;

/**
 * Cap on the commits one call publishes. Each commit is a separate mutation, so
 * a long range is a long window in which a partial publication can happen.
 */
const MAX_COMMITS_PER_PUBLICATION = 50;

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** One commit's changes, expressed the only way the mutation accepts them. */
export interface SignedCommitPlan {
  /** Commit subject line, preserved from the local commit. */
  headline: string;
  /** Commit body, preserved from the local commit (co-author trailers included). */
  body?: string;
  additions: { path: string; contents: string }[];
  deletions: { path: string }[];
}

/** Why the signed path was not taken, and the ordinary push ran instead. */
export type SignedPublishFallbackReason =
  | 'invalid-branch'
  | 'no-credentials'
  | 'no-local-branch'
  | 'checkout-elsewhere'
  | 'remote-head-unavailable'
  | 'remote-branch-missing'
  | 'up-to-date'
  | 'fetch-failed'
  | 'not-fast-forward'
  | 'history-unavailable'
  | 'too-many-commits'
  | 'inexpressible-commit'
  | 'publication-failed';

export type SignedPublishResult =
  | {
      signed: true;
      /** The signed commit the branch now points at. */
      headSha: string;
      /** False when the local branch had to be left as it was (see `warning`). */
      reconciled: boolean;
      warning?: string;
    }
  | {
      signed: false;
      reason: SignedPublishFallbackReason;
      /** Diagnostic detail for the reason, e.g. which file blocked the commit. */
      detail?: string;
    };

export interface PublishBranchSignedInput {
  sandbox: ExecutableSandbox;
  workdir: string;
  /** Branch to advance. It has to exist locally and on the remote. */
  branch: string;
  /** Push credentials for this repository (also used for the fallback push). */
  access: RepositoryAccess;
  /** Repository full name, `owner/name`, for error messages. */
  repoFullName: string;
  /** Publish one commit through the provider's signing flow. */
  createSignedCommit(commit: SignedCommitPlan & { expectedHeadSha: string }): Promise<{ sha: string }>;
  /** Current remote head of `branch`, or `null` when the branch is not on the remote. */
  readRemoteHead(): Promise<string | null>;
  /** The ordinary, unsigned publication; runs only when nothing was published. */
  unsignedFallback(): Promise<void>;
}

interface RawChange {
  kind: 'A' | 'C' | 'D' | 'M' | 'R' | 'T';
  oldMode: string;
  newMode: string;
  newSha: string;
  /** Destination path (source path for a deletion or rename). */
  path: string;
  /** Source path, for a rename or a copy. */
  from?: string;
}

type PlanOutcome = { ok: true; plan: SignedCommitPlan } | { ok: false; detail: string };

/**
 * Publish the commits the local branch is ahead of the remote by, through the
 * provider's signing flow, and move the local branch onto the signed commits.
 * Falls back to {@link PublishBranchSignedInput.unsignedFallback} only when
 * nothing at all was published.
 */
export async function publishBranchSigned(input: PublishBranchSignedInput): Promise<SignedPublishResult> {
  const { sandbox, workdir, branch } = input;
  const token = input.access.authorization?.token;
  if (!isValidGitRef(branch)) return fallback('invalid-branch', `'${branch}' is not a valid git ref`);
  if (!token) return fallback('no-credentials', 'repository access did not include push credentials');
  const env = gitAuthenticationEnvironment(
    input.access.cloneUrl,
    token,
    input.access.authorization?.username ?? 'x-access-token',
    'push-failed',
  );

  const localBranchTip = await revParse(sandbox, workdir, `refs/heads/${branch}`);
  if (localBranchTip === null) return fallback('no-local-branch', `the checkout has no ${branch} branch`);
  // A separate binding so the nested helpers below see a `string`, not a value
  // that control-flow analysis can no longer prove non-null inside a closure.
  const tip = localBranchTip;
  if (await branchCheckedOutElsewhere()) {
    return fallback('checkout-elsewhere', `${branch} is checked out in another worktree`);
  }

  let remoteHead: string | null;
  try {
    remoteHead = await input.readRemoteHead();
  } catch (error) {
    // Without the remote head there is no safe way to publish: the mutation
    // requires the branch's current head. The ordinary push reports the real
    // error.
    return fallback('remote-head-unavailable', messageOf(error));
  }
  if (remoteHead === null) return fallback('remote-branch-missing', `the remote has no ${branch} branch`);
  if (remoteHead === tip) return fallback('up-to-date', 'the branch is already published');

  if (!(await fetchBranch())) return fallback('fetch-failed', `could not fetch ${branch} from the remote`);

  const ancestor = await execute(sandbox, 'git', ['-C', workdir, 'merge-base', '--is-ancestor', remoteHead, tip]);
  if (ancestor.exitCode === 1) {
    return fallback('not-fast-forward', `the remote head ${remoteHead} is not an ancestor of ${tip}`);
  }
  if (ancestor.exitCode !== 0) return fallback('history-unavailable', 'the two heads could not be compared');

  const listed = await execute(sandbox, 'git', [
    '-C',
    workdir,
    'rev-list',
    '--reverse',
    '--topo-order',
    `${remoteHead}..${tip}`,
  ]);
  if (listed.exitCode !== 0) return fallback('history-unavailable', 'the commits to publish could not be listed');
  const commits = listed.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (commits.length === 0) return fallback('up-to-date', 'the branch is already published');
  if (commits.length > MAX_COMMITS_PER_PUBLICATION) {
    return fallback('too-many-commits', `${commits.length} commits on top of ${remoteHead}`);
  }

  // Plan every commit before publishing any of them: a commit the mutation
  // cannot express must not leave its predecessors published on their own.
  const plans: SignedCommitPlan[] = [];
  for (const commit of commits) {
    const outcome = await planCommit(sandbox, workdir, commit);
    if (!outcome.ok) return fallback('inexpressible-commit', outcome.detail);
    plans.push(outcome.plan);
  }

  const publishedShas: string[] = [];
  let expected = remoteHead;
  try {
    for (const plan of plans) {
      const { sha } = await input.createSignedCommit({ ...plan, expectedHeadSha: expected });
      if (!SHA_PATTERN.test(sha)) {
        throw new Error(`the provider returned no commit sha for ${plan.headline}`);
      }
      publishedShas.push(sha);
      expected = sha;
    }
  } catch (error) {
    return settleFailedPublication(error, publishedShas);
  }

  let headNow: string | null;
  try {
    headNow = await input.readRemoteHead();
  } catch (error) {
    throw new Error(
      `Published ${publishedShas.length} signed commit(s) to ${input.repoFullName}@${branch}, but the branch head could not be re-read (${messageOf(error)}). The local branch was left untouched; inspect the branch before pushing again.`,
    );
  }
  if (headNow !== expected) {
    throw new Error(
      `Published signed commits to ${input.repoFullName}@${branch}, but its head is ${headNow ?? 'missing'} rather than the commit just created (${expected}). The local branch was left untouched; another writer may have advanced the branch.`,
    );
  }
  if (!(await fetchBranch())) {
    throw new Error(
      `Published signed commit ${expected} to ${input.repoFullName}@${branch}, but it could not be fetched back to reconcile the local branch (still at ${tip}). Reconcile the branch before pushing again.`,
    );
  }

  const reconciliation = await reconcile(sandbox, workdir, branch, tip, expected);
  return {
    signed: true,
    headSha: expected,
    reconciled: reconciliation.reconciled,
    ...(reconciliation.warning ? { warning: reconciliation.warning } : {}),
  };

  /** Run the ordinary push, which is only ever reached with nothing published. */
  async function fallback(reason: SignedPublishFallbackReason, detail?: string): Promise<SignedPublishResult> {
    await input.unsignedFallback();
    return { signed: false, reason, ...(detail ? { detail } : {}) };
  }

  async function fetchBranch(): Promise<boolean> {
    const fetch = await execute(sandbox, 'git', ['-C', workdir, 'fetch', '--no-tags', 'origin', branch], { env });
    return fetch.exitCode === 0;
  }

  /**
   * Decide what a failed publication left behind. Nothing may fall back once a
   * signed commit exists, so a failure with commits published is always an
   * error; a failure before the first commit is safe to fall back from, unless
   * the head moved anyway.
   */
  async function settleFailedPublication(error: unknown, publishedShas: string[]): Promise<SignedPublishResult> {
    let headNow: string | null;
    try {
      headNow = await input.readRemoteHead();
    } catch (readError) {
      throw new Error(
        `Signed publication of ${input.repoFullName}@${branch} failed (${messageOf(error)}), and the branch state could not be determined (${messageOf(readError)}). Nothing was force-pushed; inspect the branch before pushing again.`,
      );
    }

    if (publishedShas.length > 0) {
      throw new Error(
        `Signed publication of ${input.repoFullName}@${branch} stopped after ${publishedShas.length} of ${plans.length} commits (${messageOf(error)}). The branch now points at ${headNow ?? 'nothing'}; this run published ${publishedShas.join(', ')}. Nothing was force-pushed — inspect the branch before pushing again.`,
      );
    }

    if (headNow === remoteHead) return fallback('publication-failed', messageOf(error));

    // The head moved although no signed commit was recorded: our write may have
    // landed with its response lost, or another writer advanced the branch.
    // Identical content at the head means the branch already carries what this
    // call was about to publish, so it can be adopted and reconciled.
    if (headNow && (await fetchBranch())) {
      const headTree = await revParse(sandbox, workdir, `${headNow}^{tree}`);
      if (headTree !== null && headTree === (await revParse(sandbox, workdir, `${tip}^{tree}`))) {
        const reconciliation = await reconcile(sandbox, workdir, branch, tip, headNow);
        return {
          signed: true,
          headSha: headNow,
          reconciled: reconciliation.reconciled,
          ...(reconciliation.warning ? { warning: reconciliation.warning } : {}),
        };
      }
    }

    throw new Error(
      `Signed publication of ${input.repoFullName}@${branch} failed (${messageOf(error)}) while nothing was recorded, yet the branch head moved to ${headNow ?? 'a missing branch'}. Nothing was force-pushed; inspect the branch before pushing again.`,
    );
  }

  /** Whether this branch is checked out in a worktree other than the calling one. */
  async function branchCheckedOutElsewhere(): Promise<boolean> {
    const head = await execute(sandbox, 'git', ['-C', workdir, 'symbolic-ref', '--quiet', 'HEAD']);
    if (head.exitCode === 0 && head.stdout.trim() === `refs/heads/${branch}`) return false;
    const worktrees = await execute(sandbox, 'git', ['-C', workdir, 'worktree', 'list', '--porcelain', '-z']);
    if (worktrees.exitCode !== 0) return false;
    // This checkout holds a different branch, so any worktree holding `branch`
    // is another one: `update-ref` below would move that worktree's HEAD.
    return worktrees.stdout.split('\0').some(entry => entry === `branch refs/heads/${branch}`);
  }
}

/**
 * Move the local branch onto the signed commit that carries its exact tree.
 * A checked-out branch is reset softly, which leaves the index and the working
 * tree — including uncommitted work — untouched because the trees are equal.
 * Any other branch is moved with a compare-and-swap so a concurrent local
 * commit is never clobbered.
 */
async function reconcile(
  sandbox: ExecutableSandbox,
  workdir: string,
  branch: string,
  tip: string,
  signedSha: string,
): Promise<{ reconciled: boolean; warning?: string }> {
  const signedTree = await revParse(sandbox, workdir, `${signedSha}^{tree}`);
  const localTree = await revParse(sandbox, workdir, `${tip}^{tree}`);
  if (signedTree === null || localTree === null || signedTree !== localTree) {
    throw new Error(
      `Signed commit ${signedSha} does not carry the local tree of ${branch} (${tip}); refusing to move the local branch.`,
    );
  }

  const head = await execute(sandbox, 'git', ['-C', workdir, 'symbolic-ref', '--quiet', 'HEAD']);
  if (head.exitCode === 0 && head.stdout.trim() === `refs/heads/${branch}`) {
    const reset = await execute(sandbox, 'git', ['-C', workdir, 'reset', '--soft', signedSha]);
    if (reset.exitCode !== 0) {
      throw new Error(
        `Signed commit ${signedSha} is published, but resetting the checked-out ${branch} failed: ${firstLine(reset.stderr)}.`,
      );
    }
    return { reconciled: true };
  }

  const moved = await execute(sandbox, 'git', ['-C', workdir, 'update-ref', `refs/heads/${branch}`, signedSha, tip]);
  if (moved.exitCode !== 0) {
    return {
      reconciled: false,
      warning: `Signed commit ${signedSha} is published, but refs/heads/${branch} could not be moved onto it: ${firstLine(moved.stderr)}.`,
    };
  }
  return { reconciled: true };
}

/** Build one commit's signed-publication plan, or say why it cannot be built. */
async function planCommit(sandbox: ExecutableSandbox, workdir: string, commit: string): Promise<PlanOutcome> {
  const parents = await readParents(sandbox, workdir, commit);
  if (parents === null) return { ok: false, detail: `${short(commit)}: the commit's parents could not be read` };
  if (parents.length > 1) return { ok: false, detail: `${short(commit)} is a merge commit` };

  const diff =
    parents.length === 0
      ? await execute(sandbox, 'git', [
          '-C',
          workdir,
          'diff-tree',
          '-r',
          '-z',
          '--raw',
          '--no-commit-id',
          '--root',
          commit,
        ])
      : await execute(sandbox, 'git', [
          '-C',
          workdir,
          'diff-tree',
          '-r',
          '-z',
          '--raw',
          '--no-commit-id',
          parents[0]!,
          commit,
        ]);
  if (diff.exitCode !== 0) return { ok: false, detail: `${short(commit)}: the file changes could not be read` };

  const changes = parseRawDiff(diff.stdout);
  if (changes === null) return { ok: false, detail: `${short(commit)}: the file changes could not be understood` };
  if (changes.length === 0) return { ok: false, detail: `${short(commit)} changes no files` };
  if (changes.length > MAX_FILE_CHANGES_PER_COMMIT) {
    return { ok: false, detail: `${short(commit)} changes ${changes.length} files in one commit` };
  }

  const message = await readMessage(sandbox, workdir, commit);
  if (message === null) return { ok: false, detail: `${short(commit)}: the commit message could not be read` };

  const additions: { path: string; contents: string }[] = [];
  const deletions: { path: string }[] = [];
  const blobs: { path: string; sha: string }[] = [];
  for (const change of changes) {
    const translation = translateChange(change);
    if (!translation.ok) return { ok: false, detail: `${short(commit)}: ${translation.reason}` };
    for (const path of translation.deletions) deletions.push({ path });
    if (translation.addition) {
      additions.push({ path: change.path, contents: '' });
      blobs.push({ path: change.path, sha: change.newSha });
    }
  }

  if (additions.length === 0 && deletions.length === 0) {
    return { ok: false, detail: `${short(commit)} changes no files` };
  }

  const sizes = await readBlobSizes(
    sandbox,
    workdir,
    blobs.map(blob => blob.sha),
  );
  if (sizes !== null) {
    const total = sizes.reduce((sum, size) => sum + size, 0);
    if (total > MAX_CONTENT_BYTES_PER_COMMIT) {
      return { ok: false, detail: `${short(commit)} carries ${total} bytes of file content` };
    }
  }

  for (const [index, blob] of blobs.entries()) {
    const contents = await readBlobContents(sandbox, workdir, blob.sha);
    if (contents === null) {
      return { ok: false, detail: `${short(commit)}: the contents of ${blob.path} could not be read` };
    }
    additions[index] = { path: blob.path, contents };
  }

  return { ok: true, plan: { ...message, additions, deletions } };
}

/**
 * How one raw change translates into the mutation's file interface.
 *
 * Only regular files (mode 100644) are publishable: the mutation cannot set an
 * executable bit, write a symlink, add a submodule, or change a path's type, and
 * publishing any of those as an ordinary file would silently alter the tree. A
 * rename is expressed as a deletion plus an addition, and a copy as an addition
 * only (the source keeps its own entry).
 */
type ChangeTranslation =
  | { ok: true; deletions: string[]; addition: boolean }
  | { ok: false; reason: string };

function translateChange(change: RawChange): ChangeTranslation {
  if (change.kind === 'D') return { ok: true, deletions: [change.path], addition: false };
  if (change.kind === 'R') {
    if (change.oldMode !== '100644' || change.newMode !== '100644') {
      return { ok: false, reason: modeReason(change) };
    }
    return { ok: true, deletions: [change.from!], addition: true };
  }
  if (change.kind === 'A' || change.kind === 'C') {
    if (change.newMode !== '100644') {
      return {
        ok: false,
        reason: `${change.path} would be published as a plain file instead of ${describeMode(change.newMode)}`,
      };
    }
    return { ok: true, deletions: [], addition: true };
  }
  if (change.oldMode !== '100644' || change.newMode !== '100644') {
    return { ok: false, reason: modeReason(change) };
  }
  return { ok: true, deletions: [], addition: true };
}

function modeReason(change: RawChange): string {
  return `${change.path} changes file mode ${describeMode(change.oldMode)} to ${describeMode(change.newMode)}`;
}

function describeMode(mode: string): string {
  switch (mode) {
    case '100644':
      return 'a plain file';
    case '100755':
      return 'an executable file';
    case '120000':
      return 'a symlink';
    case '160000':
      return 'a submodule';
    case '000000':
      return 'nothing';
    default:
      return `mode ${mode}`;
  }
}

/**
 * Parse `git diff-tree -r -z --raw` output: one record per change, as
 * `:<old mode> <new mode> <old sha> <new sha> <status>\0<path>\0`, with a second
 * path for a rename or a copy. NUL separators keep paths that contain spaces or
 * newlines unambiguous. Returns `null` rather than guessing when the output does
 * not have that shape, since guessing would publish a wrong tree.
 */
function parseRawDiff(output: string): RawChange[] | null {
  const tokens = output.split('\0');
  const changes: RawChange[] = [];
  for (let index = 0; index < tokens.length; ) {
    const header = tokens[index]!;
    if (header === '') {
      index += 1;
      continue;
    }
    if (!header.startsWith(':')) return null;
    const [oldMode, newMode, , newSha, status] = header.slice(1).split(' ');
    const kind = status?.[0];
    if (!oldMode || !newMode || !newSha || !kind || !'ACDMRT'.includes(kind)) return null;
    const paired = kind === 'R' || kind === 'C';
    const first = tokens[index + 1];
    const second = paired ? tokens[index + 2] : undefined;
    if (first === undefined || (paired && second === undefined)) return null;
    changes.push({
      kind: kind as RawChange['kind'],
      oldMode,
      newMode,
      newSha,
      path: (paired ? second : first)!,
      ...(paired ? { from: first } : {}),
    });
    index += paired ? 3 : 2;
  }
  return changes;
}

/** The commit's parents, or `null` when they could not be read. */
async function readParents(sandbox: ExecutableSandbox, workdir: string, commit: string): Promise<string[] | null> {
  const result = await execute(sandbox, 'git', ['-C', workdir, 'log', '-1', '--format=%P', commit]);
  if (result.exitCode !== 0) return null;
  const line = result.stdout.trim();
  return line === '' ? [] : line.split(/\s+/);
}

/** The commit message, split into the subject line and the rest, or `null`. */
async function readMessage(
  sandbox: ExecutableSandbox,
  workdir: string,
  commit: string,
): Promise<{ headline: string; body?: string } | null> {
  const result = await execute(sandbox, 'git', ['-C', workdir, 'log', '-1', '--format=%B', commit]);
  if (result.exitCode !== 0) return null;
  const message = result.stdout.replace(/\s+$/, '');
  const newline = message.indexOf('\n');
  const headline = (newline === -1 ? message : message.slice(0, newline)).trim();
  if (headline === '') return null;
  const body = (newline === -1 ? '' : message.slice(newline + 1)).replace(/^\s+/, '');
  return { headline, ...(body === '' ? {} : { body }) };
}

/**
 * Byte sizes of the given blobs, in order, or `null` when they could not be
 * measured (a missing `cat-file` is not worth failing the publication over —
 * the contents are read and the size re-checked as they are gathered).
 */
async function readBlobSizes(
  sandbox: ExecutableSandbox,
  workdir: string,
  blobs: string[],
): Promise<number[] | null> {
  if (blobs.length === 0) return [];
  const script = `printf '%s\\n' ${blobs.map(shellQuote).join(' ')} | git -C ${shellQuote(workdir)} cat-file --batch-check='%(objectsize)'`;
  const result = await sh(sandbox, script, { phase: 'measuring files for signed publication' });
  if (result.exitCode !== 0) return null;
  const sizes = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => Number(line));
  if (sizes.length !== blobs.length || sizes.some(size => !Number.isSafeInteger(size) || size < 0)) return null;
  return sizes;
}

/**
 * One blob's contents, base64-encoded. Encoding inside the sandbox keeps binary
 * files intact: the command result is text.
 */
async function readBlobContents(
  sandbox: ExecutableSandbox,
  workdir: string,
  blob: string,
): Promise<string | null> {
  const script = `git -C ${shellQuote(workdir)} cat-file blob ${blob} | base64 | tr -d '\\n'`;
  const result = await sh(sandbox, script, { phase: 'reading file contents for signed publication' });
  if (result.exitCode !== 0) return null;
  const contents = result.stdout.trim();
  return BASE64_PATTERN.test(contents) ? contents : null;
}

async function revParse(sandbox: ExecutableSandbox, workdir: string, rev: string): Promise<string | null> {
  const result = await execute(sandbox, 'git', ['-C', workdir, 'rev-parse', '--verify', '--quiet', rev]);
  if (result.exitCode !== 0) return null;
  const sha = result.stdout.trim();
  return sha === '' ? null : sha;
}

function short(commit: string): string {
  return commit.slice(0, 12);
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? '';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
