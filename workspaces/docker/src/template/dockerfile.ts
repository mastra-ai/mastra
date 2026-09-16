/**
 * Pure Dockerfile synthesis and content-addressed identity for DockerTemplate.
 *
 * A `DockerTemplate` records an ordered list of operations (setWorkdir, setEnvs,
 * runCmd, aptInstall, npmInstall) over a base image. This module turns that
 * ordered list into a deterministic Dockerfile string and a stable content hash.
 * It performs no I/O, so it is fully unit-testable without a Docker daemon.
 */

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

export type DockerTemplateOperation =
  | { method: 'setWorkdir'; args: [string] }
  | { method: 'setEnvs'; args: [Record<string, string>] }
  | { method: 'runCmd'; args: [string | string[]] }
  | { method: 'aptInstall'; args: [string | string[], AptInstallOptions?] }
  | { method: 'npmInstall'; args: [(string | string[])?, NpmInstallOptions?] };

/**
 * A fully-resolved template definition: the base image, the ordered operations
 * baked into image layers, and the names of build-time-only (ephemeral) args
 * that are excluded from the content identity.
 */
export interface DockerTemplateDefinition {
  baseImage: string;
  operations: readonly DockerTemplateOperation[];
  /** Names of ephemeral build args, declared as `ARG` so RUN steps can read them. */
  buildArgNames: readonly string[];
}

// =============================================================================
// Dockerfile synthesis
// =============================================================================

function toCommandList(command: string | string[]): string[] {
  return Array.isArray(command) ? command : [command];
}

function renderEnvLine(envs: Record<string, string>): string | undefined {
  const pairs = Object.entries(envs);
  if (pairs.length === 0) return undefined;
  // Deterministic order so identical envs always render identically.
  const rendered = pairs
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  return `ENV ${rendered}`;
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

/**
 * Render a deterministic Dockerfile from a template definition. Operations are
 * emitted in order; ephemeral build args are declared as `ARG` right after
 * `FROM` so subsequent `RUN` steps can reference them.
 */
export function synthesizeDockerfile(definition: DockerTemplateDefinition): string {
  const lines: string[] = [`FROM ${definition.baseImage}`];

  for (const name of definition.buildArgNames) {
    lines.push(`ARG ${name}`);
  }

  for (const operation of definition.operations) {
    switch (operation.method) {
      case 'setWorkdir':
        lines.push(`WORKDIR ${operation.args[0]}`);
        break;
      case 'setEnvs': {
        const line = renderEnvLine(operation.args[0]);
        if (line) lines.push(line);
        break;
      }
      case 'runCmd': {
        const commands = toCommandList(operation.args[0]);
        lines.push(`RUN ${commands.join(' && ')}`);
        break;
      }
      case 'aptInstall':
        lines.push(renderAptInstall(operation.args[0], operation.args[1]));
        break;
      case 'npmInstall':
        lines.push(renderNpmInstall(operation.args[0], operation.args[1]));
        break;
    }
  }

  return `${lines.join('\n')}\n`;
}

// =============================================================================
// Content-addressed identity
// =============================================================================

import { createHash } from 'node:crypto';

/** Prefix for template image tags built locally. */
export const TEMPLATE_IMAGE_REPO = 'mastra-template';

/**
 * Stable content hash over the base image and ordered operations. Ephemeral
 * build args are intentionally excluded (only their values would be secret, and
 * they never enter the definition), so the same definition with different
 * secrets resolves to the same image tag.
 */
export function templateIdentity(definition: DockerTemplateDefinition): string {
  const canonical = JSON.stringify({
    schemaVersion: 1,
    baseImage: definition.baseImage,
    operations: definition.operations,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

/** Full `mastra-template:<hash>` tag for a definition. */
export function templateImageTag(definition: DockerTemplateDefinition): string {
  return `${TEMPLATE_IMAGE_REPO}:${templateIdentity(definition)}`;
}
