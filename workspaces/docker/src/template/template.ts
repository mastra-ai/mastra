/**
 * DockerTemplate — a reusable prepared baseline for the local Docker sandbox.
 *
 * Prepare an environment once (base image + ordered setup commands + env +
 * package installs), `build()` it into a content-addressed local image, then
 * spawn multiple disposable `DockerSandbox`es from that image. Each sandbox is a
 * fresh container with its own writable layer over the shared read-only image,
 * so their filesystems are independent. The built image's lifecycle is
 * controlled by `dispose()`, independent of any sandbox's `destroy()`.
 *
 * Unlike `docker commit` (which cannot capture mounted volumes and skips layer
 * caching), the baseline is produced by synthesizing a Dockerfile and running
 * `docker build`, so repo/setup content is baked into reproducible, cached
 * image layers.
 *
 * @example Prepare once, spawn many
 * ```typescript
 * import { DockerTemplate } from '@mastra/docker';
 *
 * const template = new DockerTemplate({ baseImage: 'node:22-slim' })
 *   .runCmd('git clone --depth=1 https://example.com/repo /workspace/app')
 *   .setWorkdir('/workspace/app')
 *   .runCmd('npm ci');
 *
 * const result = await template.build();
 * if (result.status !== 'ready') throw new Error(result.error);
 *
 * const a = await template.createSandbox();
 * const b = await template.createSandbox(); // independent writable filesystem
 * ```
 */

import Docker from 'dockerode';
import { pack as tarPack } from 'tar-stream';
import { DockerSandbox, type DockerSandboxOptions } from '../sandbox';
import {
  type AptInstallOptions,
  type DockerTemplateDefinition,
  type DockerTemplateOperation,
  type NpmInstallOptions,
  type RunWithSecretsOptions,
  secretNames,
  synthesizeDockerfile,
  templateImageTag,
} from './dockerfile';

const MAX_OPERATIONS = 256;
const MAX_STRING_LENGTH = 32 * 1024;
const MAX_COLLECTION_ITEMS = 512;

export interface DockerTemplateOptions {
  /**
   * Base image for the template.
   * @default 'node:22-slim'
   */
  baseImage?: string;
  /** Pass-through dockerode connection options (socket path, host, TLS certs). */
  dockerOptions?: Docker.DockerOptions;
}

export interface DockerTemplateBuildOptions {
  /** Rebuild even if an image with the computed tag already exists locally. */
  force?: boolean;
}

export interface DockerTemplateBuildResult {
  status: 'ready' | 'failed';
  /** The local image tag (`mastra-template:<hash>`) the template resolves to. */
  templateId: string;
  /** Failure detail when `status` is `'failed'`. */
  error?: string;
}

/**
 * Immutable, chainable builder + build/lifecycle for a local Docker template.
 * Operation methods return a new instance (like the platform `Template()`
 * builder); `build`/`createSandbox`/`dispose` operate against the daemon.
 */
export class DockerTemplate {
  readonly #baseImage: string;
  readonly #operations: readonly DockerTemplateOperation[];
  readonly #dockerOptions: Docker.DockerOptions | undefined;
  #docker: Docker | undefined;
  #built = false;

  constructor(options: DockerTemplateOptions = {}, state?: DockerTemplateState) {
    this.#baseImage = state ? state.baseImage : validateString(options.baseImage ?? 'node:22-slim', 'baseImage');
    this.#operations = state?.operations ?? [];
    this.#dockerOptions = options.dockerOptions;
  }

  #clone(next: Partial<DockerTemplateState>): DockerTemplate {
    return new DockerTemplate(
      { dockerOptions: this.#dockerOptions },
      {
        baseImage: next.baseImage ?? this.#baseImage,
        operations: next.operations ?? this.#operations,
      },
    );
  }

  #append(operation: DockerTemplateOperation): DockerTemplate {
    if (this.#operations.length >= MAX_OPERATIONS) {
      throw new RangeError(`Docker template cannot contain more than ${MAX_OPERATIONS} operations`);
    }
    return this.#clone({ operations: [...this.#operations, operation] });
  }

  /** Set the base image. */
  from(image: string): DockerTemplate {
    return this.#clone({ baseImage: validateString(image, 'image') });
  }

  /** Set the working directory for subsequent steps and the runtime container. */
  setWorkdir(path: string): DockerTemplate {
    return this.#append({ method: 'setWorkdir', args: [validateString(path, 'path')] });
  }

  /**
   * Set environment variables. They are baked into the image via `ENV` and
   * participate in the template identity, so never put secrets here — use
   * {@link runWithSecrets} for anything that must not persist in the image.
   */
  setEnvs(envs: Record<string, string>): DockerTemplate {
    return this.#append({ method: 'setEnvs', args: [validateStringRecord(envs, 'envs')] });
  }

  /** Run a command (or `&&`-joined list of commands) as a build step. */
  runCmd(command: string | string[]): DockerTemplate {
    return this.#append({ method: 'runCmd', args: [validateStringOrStrings(command, 'command')] });
  }

  /**
   * Run a command that needs build-time secrets, without persisting them.
   *
   * The command runs in a throwaway build stage forked from the template as it
   * stands at that point, so earlier WORKDIR/ENV/installs apply and later
   * steps see the copied `output`. The named
   * secrets are read from `process.env` when `build()` runs and exposed to the
   * command as environment variables. Only `output` is copied into the template
   * image; the values never appear in the image's layers, config, or history.
   *
   * Secret values are still handed to the local daemon as build args, so the
   * intermediate stage cached by the daemon can reveal them to anyone with
   * daemon access. Run `docker image prune` to drop those intermediates.
   */
  runWithSecrets(command: string | string[], options: RunWithSecretsOptions): DockerTemplate {
    if (!Array.isArray(options.secrets)) throw new TypeError('secrets must be an array of strings');
    if (options.secrets.length > MAX_COLLECTION_ITEMS) {
      throw new RangeError(`secrets cannot contain more than ${MAX_COLLECTION_ITEMS} items`);
    }
    const secrets = options.secrets.map(name => {
      if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`secrets must be environment variable names, got ${JSON.stringify(name)}`);
      }
      return name;
    });
    const output = validateString(options.output, 'output');
    if (!output.startsWith('/')) throw new TypeError('output must be an absolute path');
    return this.#append({
      method: 'runWithSecrets',
      args: [validateStringOrStrings(command, 'command'), { secrets, output }],
    });
  }

  /** Install apt packages. */
  aptInstall(packages: string | string[], options?: AptInstallOptions): DockerTemplate {
    return this.#append({ method: 'aptInstall', args: [validateStringOrStrings(packages, 'packages'), options] });
  }

  /** Install npm packages (or run `npm install` for the current workdir when omitted). */
  npmInstall(packages?: string | string[], options?: NpmInstallOptions): DockerTemplate {
    const validated = packages === undefined ? undefined : validateStringOrStrings(packages, 'packages');
    return this.#append({ method: 'npmInstall', args: [validated, options] });
  }

  /** The resolved definition (base image + ordered operations). */
  get definition(): DockerTemplateDefinition {
    return { baseImage: this.#baseImage, operations: this.#operations };
  }

  /** The synthesized Dockerfile for this template. */
  get dockerfile(): string {
    return synthesizeDockerfile(this.definition);
  }

  /** The content-addressed local image tag this template resolves to. */
  get templateId(): string {
    return templateImageTag(this.definition);
  }

  #getDocker(): Docker {
    if (!this.#docker) {
      this.#docker = new Docker(this.#dockerOptions);
    }
    return this.#docker;
  }

  /**
   * Build (or reuse) the template's image. Idempotent: if an image with the
   * computed tag already exists locally and `force` is not set, returns
   * `ready` without rebuilding. Otherwise synthesizes a Dockerfile, runs
   * `docker build`, and surfaces any build-step failure as `status: 'failed'`.
   *
   * @throws if a secret named by `runWithSecrets` is not set in `process.env`.
   */
  async build(options: DockerTemplateBuildOptions = {}): Promise<DockerTemplateBuildResult> {
    const docker = this.#getDocker();
    const tag = this.templateId;

    if (!options.force) {
      try {
        await docker.getImage(tag).inspect();
        this.#built = true;
        return { status: 'ready', templateId: tag };
      } catch (error) {
        if (!isImageNotFoundError(error)) throw error;
      }
    }

    // Only a real build needs the secret values; reusing a cached image must not
    // require the original credentials to still be present.
    const buildargs = this.#resolveSecrets();

    const context = tarPack();
    context.entry({ name: 'Dockerfile' }, this.dockerfile);
    context.finalize();

    try {
      const stream = await docker.buildImage(context, { t: tag, buildargs });
      await this.#followBuild(docker, stream);
    } catch (error) {
      this.#built = false;
      return { status: 'failed', templateId: tag, error: error instanceof Error ? error.message : String(error) };
    }

    this.#built = true;
    return { status: 'ready', templateId: tag };
  }

  #resolveSecrets(): Record<string, string> | undefined {
    const names = secretNames(this.definition);
    if (names.length === 0) return undefined;
    const resolved: Record<string, string> = {};
    for (const name of names) {
      const value = process.env[name];
      if (value === undefined) {
        throw new Error(`Docker template secret ${name} is not set in the environment`);
      }
      resolved[name] = value;
    }
    return resolved;
  }

  #followBuild(docker: Docker, stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null, output: Array<Record<string, unknown>>) => {
        if (err) {
          reject(err);
          return;
        }
        const failure = output?.find(entry => entry && (entry.error !== undefined || entry.errorDetail !== undefined));
        if (failure) {
          const detail = failure.errorDetail as { message?: string } | undefined;
          reject(new Error(String(detail?.message ?? failure.error ?? 'docker build failed')));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Create a `DockerSandbox` bound to the built image. Lazily builds the
   * template if it has not been built yet. Each call returns a fresh sandbox
   * with an independent writable layer. Invocation-specific `env`/config passed
   * via `options` reaches only the container and is never baked into the image.
   *
   * @throws if the (lazy) build fails.
   */
  async createSandbox(options: Omit<DockerSandboxOptions, 'image'> = {}): Promise<DockerSandbox> {
    if (!this.#built) {
      const result = await this.build();
      if (result.status !== 'ready') {
        throw new Error(`Docker template build failed: ${result.error ?? 'unknown error'}`);
      }
    }
    return new DockerSandbox({
      ...options,
      image: this.templateId,
      dockerOptions: options.dockerOptions ?? this.#dockerOptions,
    });
  }

  /**
   * Remove the built image (`docker rmi`). Tolerant of an already-removed
   * image. Independent of any sandbox created from this template, but the
   * daemon refuses to remove an image that a container (running or stopped)
   * still references, so destroy those sandboxes first.
   */
  async dispose(): Promise<void> {
    const docker = this.#getDocker();
    try {
      await docker.getImage(this.templateId).remove();
    } catch (error) {
      if (!isImageNotFoundError(error)) throw error;
    }
    this.#built = false;
  }
}

interface DockerTemplateState {
  baseImage: string;
  operations: readonly DockerTemplateOperation[];
}

// =============================================================================
// Validation (mirrors platform template validation)
// =============================================================================

function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
  if (value.length > MAX_STRING_LENGTH) {
    throw new RangeError(`${name} cannot exceed ${MAX_STRING_LENGTH} characters`);
  }
  return value;
}

function validateStringOrStrings(value: unknown, name: string): string | string[] {
  if (typeof value === 'string') return validateString(value, name);
  if (!Array.isArray(value)) throw new TypeError(`${name} must be a string or an array of strings`);
  if (value.length === 0) throw new TypeError(`${name} must not be empty`);
  if (value.length > MAX_COLLECTION_ITEMS) {
    throw new RangeError(`${name} cannot contain more than ${MAX_COLLECTION_ITEMS} items`);
  }
  return value.map((item, index) => validateString(item, `${name}[${index}]`));
}

function validateStringRecord(value: unknown, name: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_COLLECTION_ITEMS) {
    throw new RangeError(`${name} cannot contain more than ${MAX_COLLECTION_ITEMS} items`);
  }
  return Object.fromEntries(
    entries.map(([key, item]) => {
      if (typeof item !== 'string') throw new TypeError(`${name}.${key} must be a string`);
      return [validateString(key, `${name} key`), item];
    }),
  );
}

function isImageNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('no such image') || msg.includes('404');
  }
  return false;
}
