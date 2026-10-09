import type { PublicSchema } from '@mastra/core/schema';
import { FactorySandbox } from '@mastra/core/workspace';
import type {
  FactorySandboxBuild,
  FactorySandboxBuildStart,
  FactorySandboxBuilds,
  FactorySandboxContext,
} from '@mastra/core/workspace';

import { DockerSandbox } from './sandbox';
import type { DockerSandboxOptions } from './sandbox';
import { createDockerRepoTemplate } from './template/repo-template';
import type { DockerRepoTemplateOptions, DockerRepoTemplateResolver } from './template/repo-template';
import type { DockerTemplateBuildResult } from './template/template';

interface LocalBuild {
  startedAt: string;
  finishedAt?: string;
  result?: DockerTemplateBuildResult;
}

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

  /**
   * Image builds started by this process, keyed by image tag. Docker builds
   * locally, so a build only exists while the daemon runs it; after a host
   * restart `get` answers `unknown` for ids it does not hold.
   */
  readonly #builds = new Map<string, LocalBuild>();

  readonly builds: FactorySandboxBuilds<DockerFactorySandboxSettings> = {
    start: (ctx, settings) => this.#startBuild(ctx, settings),
    get: (_ctx, _settings, buildId) => Promise.resolve(this.#getBuild(buildId)),
  };

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

  async #startBuild(
    ctx: FactorySandboxContext,
    settings: DockerFactorySandboxSettings,
  ): Promise<FactorySandboxBuildStart> {
    const template = await this.template(ctx, settings)?.();
    if (!template) throw new Error('DockerFactorySandbox.builds: the session context yields no template to build');
    const buildId = template.templateId;
    const running = this.#builds.get(buildId);
    if (running && !running.result) return { buildId, templateId: buildId, status: 'building' };
    const build: LocalBuild = { startedAt: new Date().toISOString() };
    this.#builds.set(buildId, build);
    void template
      .build()
      .then(
        result => result,
        (error: unknown): DockerTemplateBuildResult => ({
          status: 'failed',
          templateId: buildId,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
      .then(result => {
        build.result = result;
        build.finishedAt = new Date().toISOString();
      });
    return { buildId, templateId: buildId, status: 'building' };
  }

  #getBuild(buildId: string): FactorySandboxBuild {
    const build = this.#builds.get(buildId);
    if (!build) return { buildId, status: 'unknown' };
    return {
      buildId,
      templateId: buildId,
      status: build.result?.status ?? 'building',
      startedAt: build.startedAt,
      ...(build.finishedAt ? { finishedAt: build.finishedAt } : {}),
      ...(build.result?.error ? { error: build.result.error } : {}),
    };
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
