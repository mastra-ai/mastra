import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Template, type SandboxTemplateBuilder } from './template.js';

const execFileAsync = promisify(execFile);
const REPO_FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const WORKDIR_PATTERN = /^(?:\$HOME|)(?:\/[\w.-]+)+$/;

export interface PlatformRepoTemplateOptions {
  /** GitHub owner/repository slug. */
  repoFullName: string;
  /** Commit to bake into the template. Omit to resolve the public default-branch head lazily. */
  sha?: string;
  /** Setup command run inside the checkout during the provider build. */
  setupCommand?: string;
  /** Checkout path. Defaults to $HOME/<repository>. */
  workdir?: string;
  /** Test/integration seam for resolving the public default-branch head. */
  resolveHead?: (repoFullName: string) => Promise<string | undefined>;
}

export type PlatformRepoTemplateResolver = () => Promise<SandboxTemplateBuilder | undefined>;

/**
 * Create a lazy, credential-free repository template definition for PlatformSandbox.
 *
 * The resolver performs no work until a fresh sandbox starts. It pins public
 * repositories to their current default-branch commit. If the head cannot be
 * resolved (including private repositories), it returns undefined so
 * PlatformSandbox boots from the provider default and Factory's authenticated
 * runtime setup materializes the checkout instead.
 */
export function createRepoTemplate(options: PlatformRepoTemplateOptions): PlatformRepoTemplateResolver {
  validateRepoTemplateOptions(options);
  const resolveHead = options.resolveHead ?? resolveDefaultBranchHead;

  return async () => {
    const sha = options.sha ?? (await resolveHead(options.repoFullName).catch(() => undefined));
    if (!sha || !SHA_PATTERN.test(sha)) return undefined;

    const workdir = options.workdir ?? defaultWorkdir(options.repoFullName);
    const cloneUrl = `https://github.com/${options.repoFullName}.git`;
    const steps = [
      `git clone ${cloneUrl} "${workdir}"`,
      `git -C "${workdir}" fetch origin ${sha}`,
      `git -C "${workdir}" checkout ${sha}`,
      ...(options.setupCommand ? [`cd "${workdir}" && ${options.setupCommand}`] : []),
    ];

    // Commit-independent lineage key. The platform uses it to find a
    // same-lineage prior build so new commits boot on a warm filesystem
    // while the exact template continues to build in the background.
    const lineageId = `repo:${options.repoFullName}:${workdir}`;
    return Template().runCmd(steps).withLineageId(lineageId);
  };
}

function validateRepoTemplateOptions(options: PlatformRepoTemplateOptions): void {
  if (!REPO_FULL_NAME_PATTERN.test(options.repoFullName)) {
    throw new Error(`Invalid repoFullName '${options.repoFullName}': expected 'owner/repo'`);
  }
  if (options.sha !== undefined && !SHA_PATTERN.test(options.sha)) {
    throw new Error(`Invalid sha '${options.sha}': expected a 7-40 char hex commit sha`);
  }
  const workdir = options.workdir ?? defaultWorkdir(options.repoFullName);
  if (!WORKDIR_PATTERN.test(workdir) || workdir.includes('..')) {
    throw new Error(`Invalid workdir '${workdir}': expected a $HOME-relative or absolute path with no traversal`);
  }
}

function defaultWorkdir(repoFullName: string): string {
  return `$HOME/${repoFullName.split('/')[1]}`;
}

async function resolveDefaultBranchHead(repoFullName: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['ls-remote', `https://github.com/${repoFullName}.git`, 'HEAD'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    const sha = stdout.trim().split(/\s+/, 1)[0];
    return sha && SHA_PATTERN.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}
