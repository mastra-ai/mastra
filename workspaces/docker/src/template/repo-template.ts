/**
 * createDockerRepoTemplate — a convenience over {@link DockerTemplate} that
 * prepares a repository checkout at an exact ref/commit plus setup commands as
 * a reusable, content-addressed local image.
 *
 * Because a Docker template is built locally, the clone and setup are baked into
 * image layers at `build()` time (no runtime head resolution is needed, unlike
 * the platform repo template). Booting many sandboxes from the resulting image
 * gives each one the same prepared checkout with an independent writable layer.
 *
 * A private-repo token is injected only as an ephemeral build arg — it is read
 * from the given `tokenEnv` name at build time and never becomes part of the
 * template's content identity.
 *
 * @example
 * ```typescript
 * const template = createDockerRepoTemplate({
 *   repoUrl: 'https://github.com/acme/app.git',
 *   commit: 'a1b2c3d',
 *   setupCommands: ['npm ci', 'npm run build'],
 * });
 * await template.build();
 * const sandbox = await template.createSandbox();
 * ```
 */

import { normalizeSetupCommands, repoCloneCommand, setupMarkerCommand, setupMarkerContent } from '@internal/workspace';
import type { DockerOptions } from 'dockerode';
import { DockerTemplate } from './template';

export interface DockerRepoTemplateOptions {
  /** Plain https clone URL, without embedded credentials. */
  repoUrl: string;
  /**
   * Exact commit SHA to check out. When set, the full history is cloned so any
   * commit is reachable, then checked out — giving a reproducible baseline.
   */
  commit?: string;
  /**
   * Branch or tag to check out. Ignored when `commit` is set. Omit to use the
   * remote's default branch (a shallow single-branch clone).
   */
  branch?: string;
  /**
   * Directory the repo is cloned into and the template's working directory.
   * @default '/workspace/repo'
   */
  destination?: string;
  /**
   * Base image for the template. Must have `git` and `ca-certificates`
   * available.
   * @default 'node:22-slim'
   */
  baseImage?: string;
  /**
   * Name of an environment variable holding a GitHub token for private repos.
   * Its value is injected as an ephemeral build arg (excluded from identity).
   */
  tokenEnv?: string;
  /** Commands to run after the checkout (e.g. installing dependencies). */
  setupCommands?: string | string[];
  /** Pass-through dockerode connection options. */
  dockerOptions?: DockerOptions;
}

const DEFAULT_DESTINATION = '/workspace/repo';

export function createDockerRepoTemplate(options: DockerRepoTemplateOptions): DockerTemplate {
  const destination = options.destination ?? DEFAULT_DESTINATION;

  let template = new DockerTemplate({
    baseImage: options.baseImage ?? 'node:22-slim',
    dockerOptions: options.dockerOptions,
  });

  // The token is provided as an ephemeral build arg so `git` can read it during
  // build without it entering the template's content identity.
  if (options.tokenEnv) {
    template = template.setEnvs({ [options.tokenEnv]: `\${${options.tokenEnv}}` }, { ephemeral: true });
  }

  if (options.commit) {
    // Full clone so an arbitrary commit is reachable, then pin to it.
    const clone = repoCloneCommandFull({ cloneUrl: options.repoUrl, destination, tokenEnv: options.tokenEnv });
    template = template
      .runCmd(clone)
      .runCmd(`git -C ${shellQuote(destination)} checkout ${shellQuote(options.commit)}`);
  } else {
    template = template.runCmd(
      repoCloneCommand({ cloneUrl: options.repoUrl, destination, branch: options.branch, tokenEnv: options.tokenEnv }),
    );
  }

  template = template.setWorkdir(destination);

  const setupCommands = normalizeSetupCommands(options.setupCommands);
  if (setupCommands.length > 0) {
    for (const command of setupCommands) {
      template = template.runCmd(command);
    }
    // Write the completion marker last, so it only exists when setup succeeded.
    template = template.runCmd(setupMarkerCommand(setupMarkerContent(setupCommands)));
  }

  return template;
}

/** Full (non-shallow) clone with the same per-invocation auth semantics as the shared shallow clone. */
function repoCloneCommandFull({
  cloneUrl,
  destination,
  tokenEnv,
}: {
  cloneUrl: string;
  destination: string;
  tokenEnv?: string;
}): string {
  const auth = tokenEnv
    ? `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)" `
    : '';
  return `git ${auth}clone ${shellQuote(cloneUrl)} ${shellQuote(destination)}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
