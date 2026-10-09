import type { PublicSchema } from '@mastra/core/schema';
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';

import { DockerSandbox } from './sandbox';
import type { DockerSandboxOptions } from './sandbox';
import { createDockerRepoTemplate } from './template/repo-template';
import type { DockerRepoTemplateOptions, DockerRepoTemplateResolver } from './template/repo-template';

/** User-tunable settings of a Docker factory sandbox. Every field is optional; absent means the provider default. */
export interface DockerFactorySandboxSettings extends Record<string, unknown> {
  /** Base image of the environment template. Part of the template identity. */
  baseImage?: string;
  /** `user[:group]` or `uid[:gid]` that owns the checkout. Part of the template identity. */
  owner?: string;
}

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    baseImage: {
      type: 'string',
      title: 'Base image',
      description: 'Docker image the environment template builds from (default node:22-slim)',
      minLength: 1,
    },
    owner: {
      type: 'string',
      title: 'Owner',
      description: 'user[:group] or uid[:gid] that owns the repositories in the image (default root)',
      pattern: '^[\\w.-]+(:[\\w.-]+)?$',
    },
  },
  additionalProperties: false,
} as const satisfies PublicSchema;

export interface DockerFactorySandboxOptions extends Omit<DockerSandboxOptions, 'id' | 'template'> {
  /** Options for the environment's repo template. */
  template?: Pick<DockerRepoTemplateOptions, 'buildEnv' | 'dockerOptions'>;
  /** Provider-side defaults used when a setting is unset. Never stored by factory. */
  defaults?: Partial<DockerFactorySandboxSettings>;
}

/**
 * The Docker host contract for factory: every session sandbox is a
 * {@link DockerSandbox} whose template is {@link createDockerRepoTemplate}
 * over the session's repositories, built from the factory's environment
 * settings.
 */
export class DockerFactorySandbox extends FactorySandbox<DockerFactorySandboxSettings> {
  readonly provider = 'docker';
  readonly settings: PublicSchema<DockerFactorySandboxSettings> = SETTINGS_SCHEMA;

  readonly #options: DockerFactorySandboxOptions;

  constructor(options: DockerFactorySandboxOptions = {}) {
    super();
    this.#options = options;
  }

  template(ctx: FactorySandboxContext, settings: DockerFactorySandboxSettings): DockerRepoTemplateResolver | undefined {
    const { defaults, template } = this.#options;
    const baseImage = settings.baseImage ?? defaults?.baseImage;
    const owner = settings.owner ?? defaults?.owner;
    const {
      resolveHead: _resolveHead,
      sessionId: _sessionId,
      sandboxId: _sandboxId,
      repoFullName: _name,
      ...rest
    } = ctx;
    return createDockerRepoTemplate({
      ...rest,
      ...template,
      ...(baseImage !== undefined ? { baseImage } : {}),
      ...(owner !== undefined ? { owner } : {}),
    });
  }

  create(ctx: FactorySandboxContext, settings: DockerFactorySandboxSettings): DockerSandbox {
    const { defaults: _defaults, template: _template, ...options } = this.#options;
    return new DockerSandbox({
      ...options,
      id: ctx.sessionId,
      template: this.template(ctx, settings),
      ...(ctx.workingDirectory ? { workingDirectory: ctx.workingDirectory } : {}),
    });
  }
}
