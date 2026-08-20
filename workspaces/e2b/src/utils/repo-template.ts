/**
 * Sha-aliased repo templates.
 *
 * A repo template is an E2B template with the repository already cloned and
 * its dependencies installed at a known commit. Sessions started from it only
 * need `git fetch` + checkout of their actual ref plus setup drift, instead
 * of a cold clone + full install.
 *
 * Aliases are deterministic — `mastra-repo-<hash>` where the hash covers the
 * repo, the pinned sha, the setup command, and the workdir — so a changed
 * default-branch head or setup command produces a new alias while unchanged
 * inputs reuse the existing build. Builds are lazy: the first
 * `E2BSandbox.start()` that resolves a new alias triggers the build; nothing
 * pre-builds templates for idle repos.
 *
 * Credential invariant: template builds NEVER receive a credential. The E2B
 * template build API has no secret mechanism that is excluded from image
 * capture, so any token passed to a build step could persist in a retained
 * layer. Repo templates therefore clone over plain tokenless HTTPS — public
 * repos build fine; a private repo's build fails and the sandbox falls back
 * to the fallback template, with the session's runtime setup performing the
 * full clone using its runtime-injected credential instead. Private-repo
 * template support is a follow-up pending a capture-excluded build secret.
 */
import { createHash } from 'node:crypto';

import { createDefaultMountableTemplate } from './template';
import type { NamedTemplateSpec } from './template';

const ALIAS_VERSION = 'v1';

const REPO_FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const WORKDIR_PATTERN = /^\/[\w./-]+$/;

export interface RepoTemplateOptions {
  /** GitHub `owner/repo` slug. Cloned over tokenless HTTPS. */
  repoFullName: string;
  /**
   * Commit sha the template is pinned to (typically the default-branch
   * head). Omit when unknown — the alias is then keyed on repo + setup
   * command only and the clone stays at the default branch's head at build
   * time.
   */
  sha?: string;
  /**
   * Setup command run inside the checkout during the build (e.g.
   * `pnpm install`). Hashed into the alias so a changed setup command
   * produces a new template.
   */
  setupCommand?: string;
  /**
   * Absolute path the repo is cloned to inside the image. Defaults to
   * `/workspace/<owner>/<repo>`, matching factory's deterministic remote
   * workdir.
   */
  workdir?: string;
}

/**
 * Compute the deterministic template alias for a set of repo template
 * inputs without constructing the builder. Exposed so callers (and proofs)
 * can predict which alias a sandbox will resolve.
 */
export function repoTemplateAlias(options: RepoTemplateOptions): string {
  const workdir = options.workdir ?? defaultWorkdir(options.repoFullName);
  const config = {
    version: ALIAS_VERSION,
    repoFullName: options.repoFullName,
    sha: options.sha ?? null,
    setupCommand: options.setupCommand ?? null,
    workdir,
  };
  const hash = createHash('sha256')
    .update(JSON.stringify(config, Object.keys(config).sort()))
    .digest('hex')
    .slice(0, 16);
  return `mastra-repo-${hash}`;
}

/**
 * Create a sha-aliased repo template spec for `E2BSandbox`.
 *
 * Returns a {@link NamedTemplateSpec}: the sandbox checks
 * `Template.exists(alias)` first and only builds when the alias is missing
 * (lazy, build-if-missing). When the build fails — private repo, registry
 * flake — the sandbox falls back to its default template and the session's
 * runtime setup performs the full clone, so a broken build never wedges a
 * session.
 */
export function createRepoTemplate(options: RepoTemplateOptions): NamedTemplateSpec {
  const { repoFullName, sha, setupCommand } = options;
  if (!REPO_FULL_NAME_PATTERN.test(repoFullName)) {
    throw new Error(`Invalid repoFullName '${repoFullName}': expected 'owner/repo'`);
  }
  if (sha !== undefined && !SHA_PATTERN.test(sha)) {
    throw new Error(`Invalid sha '${sha}': expected a 7-40 char hex commit sha`);
  }
  const workdir = options.workdir ?? defaultWorkdir(repoFullName);
  if (!WORKDIR_PATTERN.test(workdir) || workdir.includes('..')) {
    throw new Error(`Invalid workdir '${workdir}': expected an absolute path`);
  }

  // Tokenless HTTPS by design — see the module doc's credential invariant.
  const cloneUrl = `https://github.com/${repoFullName}.git`;

  const steps: string[] = [`git clone ${cloneUrl} ${workdir}`];
  if (sha) {
    // GitHub serves fetches of reachable shas, so pinning after a default
    // clone is reliable without full-history flags.
    steps.push(`git -C ${workdir} fetch origin ${sha}`, `git -C ${workdir} checkout ${sha}`);
  }
  if (setupCommand) {
    steps.push(`cd ${workdir} && ${setupCommand}`);
  }

  // Start from the default mountable base (s3fs/fuse) so repo-template
  // sandboxes keep filesystem mount support.
  const template = createDefaultMountableTemplate().template.runCmd(steps);

  return {
    alias: repoTemplateAlias(options),
    template,
  };
}

function defaultWorkdir(repoFullName: string): string {
  return `/workspace/${repoFullName}`;
}
