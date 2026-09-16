/**
 * createDockerRepoTemplate — a repo checkout plus setup commands as a
 * reusable, content-addressed local image, with the same contract as the
 * E2B and platform repo templates (`getRepositoryAccess`, `setupCommand`,
 * `buildEnv`, `workingDirectory`).
 *
 * Returns a template RESOLVER for `DockerSandbox`'s `template` option rather
 * than a fixed template: each resolution calls `getRepositoryAccess`, looks up
 * the current head of `ref` (`git ls-remote`, no clone) and pins that sha into
 * the template identity. A moved branch therefore yields a fresh image on the
 * next new sandbox, and an unmoved one reuses the cached image. When the head
 * cannot be resolved the resolver rejects: an unpinned clone cached under a
 * stable tag would otherwise serve stale repository state forever.
 *
 * The clone runs in a throwaway build stage; the credential is passed by value
 * to that stage only and never enters the template identity or the image.
 *
 * @example
 * ```typescript
 * const sandbox = new DockerSandbox({
 *   template: createDockerRepoTemplate({
 *     getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
 *     setupCommand: ['npm ci', 'npm run build'],
 *   }),
 * });
 * ```
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeSetupCommands, setupMarkerCommand, setupMarkerContent } from '@internal/workspace';
import type { DockerOptions } from 'dockerode';
import { DockerTemplate } from './template';

const execFileAsync = promisify(execFile);

/** Env var the build's clone reads the credential from (see `cloneFull`). */
const BUILD_TOKEN_ENV = 'GH_TOKEN';
const DEFAULT_BASE_IMAGE = 'node:22-slim';
const DEFAULT_WORKING_DIRECTORY = '/workspace';
// Only a full sha is unambiguous; a short hex string may be a branch or tag.
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

const CLONE_URL_ALLOWED_CHARS = /^[a-z0-9:/._-]+$/i;
const CLONE_URL_HOST_PATTERN = /^[a-z0-9.-]+$/i;
const CLONE_URL_SEGMENT_PATTERN = /^[\w.-]+$/;
/** Refs interpolate into shell too; git ref names are already restricted, so allowlist tightly. */
const REF_PATTERN = /^[\w./-]+$/;

/**
 * Repository clone target plus an optional credential. Structurally identical
 * to the E2B/platform type of the same name so a host can pass its context
 * accessor straight through.
 */
export interface RepositoryAccess {
  /** https clone URL, e.g. `https://github.com/acme/widgets.git`. */
  cloneUrl: string;
  /** Credential for private repositories; presented to git as `x-access-token:<token>` basic auth. */
  authorization?: { scheme: 'bearer'; token: string };
}

export interface DockerRepoTemplateOptions {
  /**
   * Resolves the clone URL and, for private repositories, a short-lived
   * credential. Called once per template resolution (each container-creating
   * `start()`): the credential authenticates the head lookup and the build's
   * clone. It is passed to the build by value, never through `process.env`,
   * and is excluded from the template identity so rotation does not rebuild.
   *
   * Pass `undefined` for the function itself to mean "no repository":
   * {@link createDockerRepoTemplate} then returns undefined so
   * `template: createDockerRepoTemplate(ctx)` needs no conditional. If the
   * function resolves to `undefined` at start time, the resolver rejects.
   */
  getRepositoryAccess: (() => Promise<RepositoryAccess | undefined>) | undefined;
  /**
   * Branch, tag, or commit to prepare. The current head of a branch/tag is
   * resolved at each template resolution and pinned into the identity.
   * @default the remote's default branch
   */
  ref?: string;
  /** Setup command(s) run inside the checkout as separate cached build steps. */
  setupCommand?: string | string[];
  /**
   * Extra environment for every build step, including `setupCommand`. Baked
   * into the image via `ENV` and hashed into the identity (keys and values),
   * so it must be non-secret; put rotating credentials in
   * {@link getRepositoryAccess} instead.
   */
  buildEnv?: Record<string, string> | (() => Promise<Record<string, string>>);
  /**
   * Absolute parent for the checkout; the repo lands at
   * `<workingDirectory>/<repo>`, which becomes the build and runtime cwd.
   * @default '/workspace'
   */
  workingDirectory?: string;
  /**
   * Base image. A custom base must provide `git` and `ca-certificates`; the
   * default has them apt-installed as the first (cached) layer.
   * @default 'node:22-slim'
   */
  baseImage?: string;
  /** Pass-through dockerode connection options. */
  dockerOptions?: DockerOptions;
}

/** A resolver producing a fresh, head-pinned template on each call. */
export type DockerRepoTemplateResolver = () => Promise<DockerTemplate>;

export function createDockerRepoTemplate(options: DockerRepoTemplateOptions): DockerRepoTemplateResolver | undefined {
  if (!options.getRepositoryAccess) return undefined;
  if (options.ref !== undefined && !REF_PATTERN.test(options.ref)) {
    throw new Error(`Invalid ref '${options.ref}': expected a git ref name`);
  }
  const workingDirectory = trimTrailingSlashes(options.workingDirectory ?? DEFAULT_WORKING_DIRECTORY);
  if (!workingDirectory.startsWith('/')) {
    throw new Error(`workingDirectory must be an absolute path, got '${options.workingDirectory}'`);
  }
  return () => resolveRepoTemplate(options, workingDirectory);
}

async function resolveRepoTemplate(
  options: DockerRepoTemplateOptions,
  workingDirectory: string,
): Promise<DockerTemplate> {
  const access = await options.getRepositoryAccess!();
  const cloneUrl = access?.cloneUrl;
  if (!cloneUrl) {
    throw new Error('Repo template has no clone URL: repository access returned none.');
  }
  assertCloneUrl(cloneUrl);
  const token = access?.authorization?.token;
  const buildEnv = typeof options.buildEnv === 'function' ? await options.buildEnv() : options.buildEnv;
  const sha = await resolveHead(cloneUrl, options.ref, token);
  if (!sha) {
    throw new Error(
      `Could not resolve ${options.ref ?? 'HEAD'} of ${cloneUrl} with git ls-remote; check the ref, the credential and network access`,
    );
  }

  return buildRepoTemplate({
    cloneUrl,
    sha,
    token,
    buildEnv,
    setupCommand: options.setupCommand,
    workingDirectory,
    baseImage: options.baseImage,
    dockerOptions: options.dockerOptions,
  });
}

interface RepoTemplateInputs {
  cloneUrl: string;
  sha: string;
  token?: string;
  buildEnv?: Record<string, string>;
  setupCommand?: string | string[];
  workingDirectory: string;
  baseImage?: string;
  dockerOptions?: DockerOptions;
}

/**
 * Pure assembly of the template from already-resolved inputs. Exported for
 * tests so the Dockerfile can be asserted without a network head lookup.
 * @internal
 */
export function buildRepoTemplate(inputs: RepoTemplateInputs): DockerTemplate {
  const { cloneUrl, sha, token, buildEnv } = inputs;
  const destination = `${trimTrailingSlashes(inputs.workingDirectory)}/${repoDirName(cloneUrl)}`;

  let template = new DockerTemplate({
    baseImage: inputs.baseImage ?? DEFAULT_BASE_IMAGE,
    dockerOptions: inputs.dockerOptions,
    ...(token ? { secrets: { [BUILD_TOKEN_ENV]: token } } : {}),
  });

  if (inputs.baseImage === undefined) {
    // The slim default ships without git; a custom base is expected to bring its own.
    template = template.aptInstall(['git', 'ca-certificates']);
  }

  if (buildEnv && Object.keys(buildEnv).length > 0) {
    template = template.setEnvs(buildEnv);
  }

  const tokenEnv = token ? BUILD_TOKEN_ENV : undefined;
  const clone = [
    // Full clone so an arbitrary commit is reachable, then pin to it. The
    // sha is in the command, so it is part of the template identity.
    cloneFull({ cloneUrl, destination, tokenEnv }),
    `git -C ${shellQuote(destination)} checkout --detach ${shellQuote(sha)}`,
  ];

  template = template
    .runWithSecrets(clone, { secrets: tokenEnv ? [tokenEnv] : [], output: destination })
    .setWorkdir(destination);

  const setupCommands = normalizeSetupCommands(inputs.setupCommand);
  for (const command of setupCommands) {
    template = template.runCmd(command);
  }
  if (setupCommands.length > 0) {
    // Written last, so the marker exists only when every setup step succeeded.
    template = template.runCmd(setupMarkerCommand(setupMarkerContent(setupCommands)));
  }
  return template;
}

/**
 * Resolve `ref` (or the default branch) to a commit sha with `git ls-remote`
 * on the host, without cloning. A full sha is returned as is. Any failure
 * yields undefined; the caller decides how to surface it.
 * @internal exported for tests.
 */
export async function resolveHead(
  cloneUrl: string,
  ref: string | undefined,
  token: string | undefined,
): Promise<string | undefined> {
  if (ref && FULL_SHA_PATTERN.test(ref)) return ref.toLowerCase();
  try {
    // The credential goes through GIT_CONFIG_* (git >= 2.31) rather than `-c`
    // so it never appears in the process argv, which other local users can read.
    const authEnv = token
      ? {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'http.extraheader',
          GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
        }
      : {};
    // `--` keeps even a hostile URL from being read as an option.
    const { stdout } = await execFileAsync('git', ['ls-remote', '--', cloneUrl, ref ?? 'HEAD'], {
      timeout: 10_000,
      env: { ...process.env, ...authEnv, GIT_TERMINAL_PROMPT: '0' },
    });
    // Prefer the peeled tag object (`refs/tags/x^{}`) when present.
    const lines = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => line.split('\t'));
    const peeled = lines.find(([, name]) => name?.endsWith('^{}'));
    const sha = (peeled ?? lines[0])?.[0]?.trim();
    return sha && SHA_PATTERN.test(sha) ? sha.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function cloneFull({ cloneUrl, destination, tokenEnv }: { cloneUrl: string; destination: string; tokenEnv?: string }) {
  // Mirrors `repoCloneCommand` from @internal/workspace, minus the shallow flags.
  const auth = tokenEnv
    ? `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)" `
    : '';
  return `git ${auth}clone ${shellQuote(cloneUrl)} ${shellQuote(destination)}`;
}

function assertCloneUrl(cloneUrl: string): void {
  if (cloneUrl.length > 2048 || !CLONE_URL_ALLOWED_CHARS.test(cloneUrl)) {
    throw new Error(`Invalid cloneUrl '${cloneUrl}': expected an https URL with a plain host and path`);
  }
  let url: URL;
  try {
    url = new URL(cloneUrl);
  } catch {
    throw new Error(`Invalid cloneUrl '${cloneUrl}': not a URL`);
  }
  const segments = url.pathname.split('/').slice(1);
  const ok =
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    CLONE_URL_HOST_PATTERN.test(url.hostname) &&
    segments.length > 0 &&
    segments.every(segment => CLONE_URL_SEGMENT_PATTERN.test(segment));
  if (!ok) {
    throw new Error(`Invalid cloneUrl '${cloneUrl}': expected an https URL such as https://host/owner/repo.git`);
  }
}

function repoDirName(cloneUrl: string): string {
  const last = trimTrailingSlashes(cloneUrl).split('/').at(-1) ?? '';
  return (
    last
      .replace(/\.git$/i, '')
      .replace(/[^\w.-]/g, '-')
      .replace(/^\.+/, '') || 'repo'
  );
}

function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
