/**
 * Pure Dockerfile synthesis and content-addressed identity for DockerTemplate.
 *
 * A `DockerTemplate` records an ordered list of operations (setWorkdir, setEnvs,
 * runCmd, runWithSecrets, aptInstall, npmInstall) over a base image. This module
 * turns that ordered list into a deterministic Dockerfile string and a stable
 * content hash. It performs no I/O, so it is fully unit-testable without a
 * Docker daemon.
 */

import { createHash } from 'node:crypto';

// =============================================================================
// Operations
// =============================================================================

export interface AptInstallOptions {
  /** Pass `--no-install-recommends` to `apt-get install`. */
  noInstallRecommends?: boolean;
  /** Pass `--fix-missing` to `apt-get install`. */
  fixMissing?: boolean;
}

export interface NpmInstallOptions {
  /** Install globally (`npm install -g`). */
  g?: boolean;
  /** Include dev dependencies (`--include=dev`). Ignored when `packages` is set. */
  dev?: boolean;
}

export interface RunWithSecretsOptions {
  /**
   * Names of environment variables whose values are read from the building
   * process's `process.env` at `build()` time and exposed to the command. Only
   * the names participate in the template identity.
   */
  secrets: string[];
  /**
   * Absolute path produced by the command. Only this path is copied into the
   * template image; everything else the command does (including the secret
   * values) stays in a throwaway build stage.
   */
  output: string;
}

export type DockerTemplateOperation =
  | { method: 'setWorkdir'; args: [string] }
  | { method: 'setEnvs'; args: [Record<string, string>] }
  | { method: 'runCmd'; args: [string | string[]] }
  | { method: 'runWithSecrets'; args: [string | string[], RunWithSecretsOptions] }
  | { method: 'aptInstall'; args: [string | string[], AptInstallOptions?] }
  | { method: 'npmInstall'; args: [(string | string[])?, NpmInstallOptions?] };

/** A fully-resolved template definition: the base image and the ordered operations. */
export interface DockerTemplateDefinition {
  baseImage: string;
  operations: readonly DockerTemplateOperation[];
}

// =============================================================================
// Dockerfile synthesis
// =============================================================================

function toCommandList(command: string | string[]): string[] {
  return Array.isArray(command) ? command : [command];
}

function sortedEntries(record: Record<string, string>): Array<[string, string]> {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function renderEnvLine(envs: Record<string, string>): string | undefined {
  const pairs = sortedEntries(envs);
  if (pairs.length === 0) return undefined;
  // Deterministic order so identical envs always render identically.
  return `ENV ${pairs.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')}`;
}

function renderAptInstall(packages: string | string[], options?: AptInstallOptions): string {
  const flags: string[] = [];
  if (options?.noInstallRecommends) flags.push('--no-install-recommends');
  if (options?.fixMissing) flags.push('--fix-missing');
  const flagStr = flags.length > 0 ? `${flags.join(' ')} ` : '';
  const pkgs = toCommandList(packages).join(' ');
  return `RUN apt-get update && apt-get install -y ${flagStr}${pkgs} && rm -rf /var/lib/apt/lists/*`;
}

function renderNpmInstall(packages?: string | string[], options?: NpmInstallOptions): string {
  const flags: string[] = [];
  if (options?.g) flags.push('-g');
  if (packages === undefined) {
    if (options?.dev) flags.push('--include=dev');
    const flagStr = flags.length > 0 ? ` ${flags.join(' ')}` : '';
    return `RUN npm install${flagStr}`;
  }
  const flagStr = flags.length > 0 ? ` ${flags.join(' ')}` : '';
  const pkgs = toCommandList(packages).join(' ');
  return `RUN npm install${flagStr} ${pkgs}`;
}

function secretStageName(index: number): string {
  return `mastra-secret-${index}`;
}

function mainStageName(index: number): string {
  return `mastra-main-${index}`;
}

/**
 * Render a deterministic Dockerfile from a template definition.
 *
 * Operations accumulate in a chain of "main" stages. Every `runWithSecrets`
 * operation forks a throwaway stage from the main stage as it stands at that
 * point (so it sees earlier WORKDIR/ENV/installs), declares the secret names as
 * `ARG`s, and runs the command. The next main stage then starts from the same
 * pre-secret snapshot and `COPY --from`s only the declared output path. Build
 * args are recorded in the history of the layers they touch, so keeping them
 * in a stage the final image never inherits is what keeps the values out of
 * the template image.
 */
export function synthesizeDockerfile(definition: DockerTemplateDefinition): string {
  const lines: string[] = [];
  let mainIndex = 0;
  const openMain = (from: string) => {
    lines.push(`FROM ${from} AS ${mainStageName(mainIndex)}`);
  };
  openMain(definition.baseImage);

  definition.operations.forEach((operation, index) => {
    switch (operation.method) {
      case 'setWorkdir':
        lines.push(`WORKDIR ${operation.args[0]}`);
        break;
      case 'setEnvs': {
        const line = renderEnvLine(operation.args[0]);
        if (line) lines.push(line);
        break;
      }
      case 'runCmd':
        lines.push(`RUN ${toCommandList(operation.args[0]).join(' && ')}`);
        break;
      case 'runWithSecrets': {
        const [command, { secrets, output }] = operation.args;
        const snapshot = mainStageName(mainIndex);
        const stage = secretStageName(index);
        lines.push(
          `FROM ${snapshot} AS ${stage}`,
          ...[...secrets].sort().map(name => `ARG ${name}`),
          `RUN ${toCommandList(command).join(' && ')}`,
        );
        mainIndex += 1;
        openMain(snapshot);
        lines.push(`COPY --from=${stage} ${output} ${output}`);
        break;
      }
      case 'aptInstall':
        lines.push(renderAptInstall(operation.args[0], operation.args[1]));
        break;
      case 'npmInstall':
        lines.push(renderNpmInstall(operation.args[0], operation.args[1]));
        break;
    }
  });

  return `${lines.join('\n')}\n`;
}

/** Names of every secret referenced by `runWithSecrets` operations, deduplicated and sorted. */
export function secretNames(definition: DockerTemplateDefinition): string[] {
  const names = new Set<string>();
  for (const operation of definition.operations) {
    if (operation.method === 'runWithSecrets') {
      for (const name of operation.args[1].secrets) names.add(name);
    }
  }
  return [...names].sort();
}

// =============================================================================
// Content-addressed identity
// =============================================================================

/** Prefix for template image tags built locally. */
export const TEMPLATE_IMAGE_REPO = 'mastra-template';

function canonicalOperation(operation: DockerTemplateOperation): unknown {
  switch (operation.method) {
    case 'setEnvs':
      return { method: 'setEnvs', args: [sortedEntries(operation.args[0])] };
    case 'runWithSecrets': {
      const [command, { secrets, output }] = operation.args;
      return { method: 'runWithSecrets', args: [command, { secrets: [...secrets].sort(), output }] };
    }
    default:
      return operation;
  }
}

/**
 * Stable content hash over the base image and ordered operations. Env records
 * and secret name lists are canonicalized so insertion order does not change
 * the identity. Secret *values* never enter the definition, so the same
 * definition built with different credentials resolves to the same image tag.
 */
export function templateIdentity(definition: DockerTemplateDefinition): string {
  const canonical = JSON.stringify({
    schemaVersion: 1,
    baseImage: definition.baseImage,
    operations: definition.operations.map(canonicalOperation),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

/** Full `mastra-template:<hash>` tag for a definition. */
export function templateImageTag(definition: DockerTemplateDefinition): string {
  return `${TEMPLATE_IMAGE_REPO}:${templateIdentity(definition)}`;
}
