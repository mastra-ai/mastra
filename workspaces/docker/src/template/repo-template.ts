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
 * stable tag would otherwise serve stale repository state forever. This holds
 * for every entry of the `repos` form too, where the platform and E2B
 * templates clone such a repository unpinned instead: those use a shallow
 * clone whose tip the session fetches past, while this template clones full
 * history and pins by `checkout`, so there is no cheap unpinned mode here.
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
import {
  WORKSPACE_SETUP_MARKER_PATH,
  guardedSetupCommand,
  normalizeSetupCommands,
  repoSetupMarkerPath,
  setupMarkerCommand,
  setupMarkerContent,
} from '@internal/workspace';
import type { DockerOptions } from 'dockerode';
import { normalizeAbortError, throwIfAborted } from '../abort';
import { DockerTemplate } from './template';

const execFileAsync = promisify(execFile);

/** Env var the build's clone reads the credential from (see `cloneAndPin`). */
const BUILD_TOKEN_ENV = 'GH_TOKEN';
const DEFAULT_BASE_IMAGE = 'node:22-slim';
const DEFAULT_WORKING_DIRECTORY = '/workspace';
// Only a full sha is unambiguous; a short hex string may be a branch or tag.
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;

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

/** One repository of a multi-repository template. */
export interface DockerRepoTemplateRepository {
  /** Resolves this repository's clone URL and credential, as {@link DockerRepoTemplateOptions.getRepositoryAccess} does for one. */
  getRepositoryAccess: (options?: DockerRepoTemplateResolveOptions) => Promise<RepositoryAccess | undefined>;
  /** Branch, tag, or commit to prepare for this repository; see {@link DockerRepoTemplateOptions.ref}. */
  ref?: string;
  /** Setup command(s) run inside this repository's checkout. */
  setupCommand?: string | string[];
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
   * `template: createDockerRepoTemplate(ctx)` needs no conditional (unless
   * `repos` is set). If the function resolves to `undefined` at start time,
   * the resolver rejects.
   */
  getRepositoryAccess?:
    | ((options?: DockerRepoTemplateResolveOptions) => Promise<RepositoryAccess | undefined>)
    | undefined;
  /**
   * Branch, tag, or commit to prepare. The current head of a branch/tag is
   * resolved at each template resolution and pinned into the identity.
   * @default the remote's default branch
   */
  ref?: string;
  /** Setup command(s) run inside the checkout as separate cached build steps. */
  setupCommand?: string | string[];
  /**
   * Several repositories in one image, each with its own access resolver,
   * `ref` and setup command, cloned to `<workingDirectory>/<repo>` in this
   * order; the working directory itself becomes the build and runtime cwd.
   * Public repositories (no `authorization`) are built before private ones in
   * caller order within each group. Each repository writes
   * `.mastra-sandbox/repos/<repo>` (`setupMarkerContent` of its commands)
   * once every step for it ran.
   *
   * Each credential is passed to that repository's clone and pin steps only,
   * as the secret `GH_TOKEN_<n>` (`n` = position in this list); setup
   * commands never see it.
   *
   * Mutually exclusive with `getRepositoryAccess`. Any entry whose access or
   * head cannot be resolved rejects the whole resolution, as the single form
   * does. Two entries that would clone into the same directory reject the
   * same way. An empty array behaves like no repository.
   */
  repos?: DockerRepoTemplateRepository[];
  /**
   * `repos` only. Command(s) run at the working directory after every
   * repository is set up (install a shared toolchain, link packages). A
   * failure fails the build. `.mastra-sandbox/workspace-setup` records the
   * digest of the commands that ran, even when there were none.
   */
  workspaceSetupCommand?: string | string[];
  /**
   * `repos` only. When true a failing per-repository setup command records
   * that repository's directory name in `.mastra-sandbox/setup-failed` (one
   * line per repository) and the build continues; clone, pin, workspace and
   * marker steps still fail the build. Default false: any failure fails the
   * build.
   */
  continueOnSetupFailure?: boolean;
  /**
   * Extra environment for every build step, including `setupCommand`. Baked
   * into the image via `ENV` and hashed into the identity (keys and values),
   * so it must be non-secret; put rotating credentials in
   * {@link getRepositoryAccess} instead.
   */
  buildEnv?: Record<string, string> | ((options?: DockerRepoTemplateResolveOptions) => Promise<Record<string, string>>);
  /**
   * Absolute parent for the checkout; the repo lands at
   * `<workingDirectory>/<repo>`, which becomes the build and runtime cwd.
   * With `repos` the working directory itself is the cwd.
   * @default '/workspace'
   */
  workingDirectory?: string;
  /**
   * Base image. A custom base must provide `git` and `ca-certificates`; the
   * default has them apt-installed as the first (cached) layer.
   * @default 'node:22-slim'
   */
  baseImage?: string;
  /**
   * Owner of the checkout, as `user[:group]` or `uid[:gid]`. Set this to the
   * base image's `USER` when it is non-root so git and writes work as that user.
   * @default root
   */
  owner?: string;
  /** Pass-through dockerode connection options. */
  dockerOptions?: DockerOptions;
}

export interface DockerRepoTemplateResolveOptions {
  /** Cancel repository access, build-environment resolution, or head lookup. */
  abortSignal?: AbortSignal;
}

/** A resolver producing a fresh, head-pinned template on each call. */
export type DockerRepoTemplateResolver = (options?: DockerRepoTemplateResolveOptions) => Promise<DockerTemplate>;

export function createDockerRepoTemplate(options: DockerRepoTemplateOptions): DockerRepoTemplateResolver | undefined {
  if (options.getRepositoryAccess && options.repos) {
    throw new TypeError('createDockerRepoTemplate: pass either getRepositoryAccess or repos, not both');
  }
  // The guard and the workspace steps have no meaning for one repository, and
  // the single-form marker must keep meaning "every setup command succeeded".
  if (!options.repos && (options.workspaceSetupCommand !== undefined || options.continueOnSetupFailure !== undefined)) {
    throw new TypeError('createDockerRepoTemplate: workspaceSetupCommand and continueOnSetupFailure require repos');
  }
  if (!options.getRepositoryAccess && !options.repos?.length) return undefined;
  const entries: DockerRepoTemplateRepository[] = options.repos ?? [
    { getRepositoryAccess: options.getRepositoryAccess!, ref: options.ref, setupCommand: options.setupCommand },
  ];
  for (const entry of entries) {
    if (entry.ref !== undefined && !REF_PATTERN.test(entry.ref)) {
      throw new Error(`Invalid ref '${entry.ref}': expected a git ref name`);
    }
    assertSingleLineCommands(entry.setupCommand, 'setupCommand');
  }
  assertSingleLineCommands(options.workspaceSetupCommand, 'workspaceSetupCommand');
  const workingDirectory = trimTrailingSlashes(options.workingDirectory ?? DEFAULT_WORKING_DIRECTORY);
  if (!workingDirectory.startsWith('/')) {
    throw new Error(`workingDirectory must be an absolute path, got '${options.workingDirectory}'`);
  }
  return resolveOptions => resolveRepoTemplate(options, entries, workingDirectory, resolveOptions);
}

async function resolveRepoTemplate(
  options: DockerRepoTemplateOptions,
  entries: DockerRepoTemplateRepository[],
  workingDirectory: string,
  resolveOptions: DockerRepoTemplateResolveOptions = {},
): Promise<DockerTemplate> {
  const { abortSignal } = resolveOptions;
  const isList = options.repos !== undefined;
  throwIfAborted(abortSignal, 'resolve Docker repository template');
  const repos: ResolvedRepository[] = [];
  const seenDirs = new Map<string, string>();
  for (const [index, entry] of entries.entries()) {
    let access: RepositoryAccess | undefined;
    try {
      access = await entry.getRepositoryAccess(resolveOptions);
    } catch (error) {
      throw normalizeAbortError(error, 'resolve Docker repository template');
    }
    throwIfAborted(abortSignal, 'resolve Docker repository template');
    const cloneUrl = access?.cloneUrl;
    if (!cloneUrl) {
      throw new Error(
        `Repo template has no clone URL: repository access returned none${isList ? ` (repos[${index}])` : ''}.`,
      );
    }
    assertCloneUrl(cloneUrl);
    const repoDir = repoDirName(cloneUrl);
    const previous = seenDirs.get(repoDir);
    if (previous) {
      throw new Error(
        `createDockerRepoTemplate: repositories ${previous} and ${cloneUrl} would both clone into "${repoDir}"`,
      );
    }
    seenDirs.set(repoDir, cloneUrl);
    const token = access?.authorization?.token;
    const sha = await resolveHead(cloneUrl, entry.ref, token, abortSignal);
    throwIfAborted(abortSignal, 'resolve Docker repository template');
    if (!sha) {
      throw new Error(
        `Could not resolve ${entry.ref ?? 'HEAD'} of ${cloneUrl} with git ls-remote; check the ref, the credential and network access`,
      );
    }
    repos.push({
      cloneUrl,
      sha,
      token,
      // The single form keeps its historical secret name; list entries are
      // numbered by caller position so public/private reordering never
      // renames one.
      tokenEnv: token ? (isList ? `${BUILD_TOKEN_ENV}_${index}` : BUILD_TOKEN_ENV) : undefined,
      setupCommand: entry.setupCommand,
    });
  }
  let buildEnv: Record<string, string> | undefined;
  try {
    buildEnv = typeof options.buildEnv === 'function' ? await options.buildEnv(resolveOptions) : options.buildEnv;
  } catch (error) {
    throw normalizeAbortError(error, 'resolve Docker repository template');
  }
  throwIfAborted(abortSignal, 'resolve Docker repository template');

  const shared = {
    buildEnv,
    workingDirectory,
    baseImage: options.baseImage,
    owner: options.owner,
    dockerOptions: options.dockerOptions,
  };
  if (!isList) {
    const [repo] = repos as [ResolvedRepository];
    return buildRepoTemplate({
      ...shared,
      cloneUrl: repo.cloneUrl,
      sha: repo.sha,
      token: repo.token,
      setupCommand: repo.setupCommand,
    });
  }
  return buildMultiRepoTemplate({
    ...shared,
    repos,
    workspaceSetupCommand: options.workspaceSetupCommand,
    continueOnSetupFailure: options.continueOnSetupFailure ?? false,
  });
}

/** One repository with its access and head resolved. */
interface ResolvedRepository {
  cloneUrl: string;
  sha: string;
  token?: string;
  tokenEnv?: string;
  setupCommand?: string | string[];
}

interface RepoTemplateInputs {
  cloneUrl: string;
  sha: string;
  token?: string;
  buildEnv?: Record<string, string>;
  setupCommand?: string | string[];
  workingDirectory: string;
  baseImage?: string;
  owner?: string;
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
  template = template
    .runWithSecrets(cloneAndPin({ cloneUrl, destination, tokenEnv, sha }), {
      secrets: tokenEnv ? [tokenEnv] : [],
      output: destination,
      ...(inputs.owner !== undefined ? { owner: inputs.owner } : {}),
    })
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

interface MultiRepoTemplateInputs {
  repos: ResolvedRepository[];
  workspaceSetupCommand?: string | string[];
  continueOnSetupFailure: boolean;
  buildEnv?: Record<string, string>;
  workingDirectory: string;
  baseImage?: string;
  owner?: string;
  dockerOptions?: DockerOptions;
}

/**
 * List-form assembly: the working directory is the cwd, every repository is
 * laid out under it (public first) around its own pin, then the workspace
 * steps and marker. Exported for tests.
 * @internal
 */
export function buildMultiRepoTemplate(inputs: MultiRepoTemplateInputs): DockerTemplate {
  const { repos, buildEnv, continueOnSetupFailure } = inputs;
  const workingDirectory = trimTrailingSlashes(inputs.workingDirectory);
  const secretValues: Record<string, string> = {};
  for (const repo of repos) if (repo.tokenEnv && repo.token) secretValues[repo.tokenEnv] = repo.token;

  let template = new DockerTemplate({
    baseImage: inputs.baseImage ?? DEFAULT_BASE_IMAGE,
    dockerOptions: inputs.dockerOptions,
    ...(Object.keys(secretValues).length > 0 ? { secrets: secretValues } : {}),
  });
  if (inputs.baseImage === undefined) {
    template = template.aptInstall(['git', 'ca-certificates']);
  }
  if (buildEnv && Object.keys(buildEnv).length > 0) {
    template = template.setEnvs(buildEnv);
  }
  // WORKDIR creates the directory owned by the image's USER, where a RUN
  // mkdir under a root-owned parent would fail on a non-root base image.
  template = template.setWorkdir(workingDirectory);

  // Public repositories first, caller order within each group: the same
  // layout as the other templates (no cache effect here, credentials are
  // build secrets and never part of a layer).
  const ordered = [...repos.filter(repo => !repo.token), ...repos.filter(repo => repo.token)];
  for (const repo of ordered) {
    const repoDir = repoDirName(repo.cloneUrl);
    const destination = `${workingDirectory}/${repoDir}`;
    const secrets = repo.tokenEnv ? [repo.tokenEnv] : [];
    const setupCommands = normalizeSetupCommands(repo.setupCommand);
    template = template.runWithSecrets(
      cloneAndPin({ cloneUrl: repo.cloneUrl, destination, tokenEnv: repo.tokenEnv, sha: repo.sha }),
      { secrets, output: destination, ...(inputs.owner !== undefined ? { owner: inputs.owner } : {}) },
    );
    // Setup steps run at the workspace cwd and `cd` into the checkout.
    for (const command of setupCommands) {
      template = template.runCmd(guardedSetupCommand({ repoDir, command, continueOnFailure: continueOnSetupFailure }));
    }
    // Last for this repository, so it only exists once every step above ran.
    template = template.runCmd(setupMarkerCommand(setupMarkerContent(setupCommands), repoSetupMarkerPath(repoDir)));
  }
  const workspaceCommands = normalizeSetupCommands(inputs.workspaceSetupCommand);
  for (const command of workspaceCommands) template = template.runCmd(command);
  template = template.runCmd(setupMarkerCommand(setupMarkerContent(workspaceCommands), WORKSPACE_SETUP_MARKER_PATH));
  return template;
}

/**
 * A Dockerfile `RUN` only spans lines through `\\` continuation, which the
 * parser folds away; a bare newline would start a new instruction.
 */
function assertSingleLineCommands(commands: string | string[] | undefined, option: string): void {
  for (const command of normalizeSetupCommands(commands)) {
    if (/(?<!\\)\n|\r/.test(command)) {
      throw new Error(
        `createDockerRepoTemplate: ${option} entries cannot contain a bare newline; end the line with \\ or pass separate commands`,
      );
    }
  }
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
  abortSignal?: AbortSignal,
): Promise<string | undefined> {
  throwIfAborted(abortSignal, 'resolve Docker repository template');
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
      signal: abortSignal,
      env: { ...process.env, ...authEnv, GIT_TERMINAL_PROMPT: '0' },
    });
    // Prefer the peeled tag object (`refs/tags/x^{}`) when present.
    const lines = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => line.split('\t'));
    const peeled = lines.find(([, name]) => name?.endsWith('^{}'));
    const sha = (peeled ?? lines[0])?.[0]?.trim();
    return sha && FULL_SHA_PATTERN.test(sha) ? sha.toLowerCase() : undefined;
  } catch (error) {
    if (abortSignal?.aborted) throw normalizeAbortError(error, 'resolve Docker repository template');
    return undefined;
  }
}

function cloneAndPin({
  cloneUrl,
  destination,
  tokenEnv,
  sha,
}: {
  cloneUrl: string;
  destination: string;
  tokenEnv?: string;
  sha: string;
}): string[] {
  // Mirrors `repoCloneCommand` from @internal/workspace, minus the shallow
  // flags: a full clone so an arbitrary commit is reachable, then the pin.
  // The sha is in the command, so it is part of the template identity.
  const auth = tokenEnv
    ? `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)" `
    : '';
  return [
    `git ${auth}clone ${shellQuote(cloneUrl)} ${shellQuote(destination)}`,
    `git -C ${shellQuote(destination)} checkout --detach ${shellQuote(sha)}`,
  ];
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
