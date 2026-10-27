import type { PublicSchema } from '@mastra/core/schema';
import { FactorySandbox } from '@mastra/core/workspace';
import type {
  FactorySandboxBuild,
  FactorySandboxBuildStart,
  FactorySandboxBuildStatus,
  FactorySandboxBuilds,
  FactorySandboxContext,
} from '@mastra/core/workspace';

import { createRepoTemplate } from './repo-template.js';
import type { PlatformRepoTemplateResolver } from './repo-template.js';
import { PlatformSandbox } from './sandbox.js';
import type { PlatformSandboxOptions } from './sandbox.js';
import type { SandboxTemplateBuilder, SandboxTemplateBuildResult } from './template.js';

/** User-tunable settings of a platform factory sandbox. Every field is optional; absent means the provider default. */
export interface PlatformFactorySandboxSettings extends Record<string, unknown> {
  /** vCPUs for the sandbox template. Part of the template identity. */
  cpuCount?: number;
  /** Memory in MB for the sandbox template. Part of the template identity. */
  memoryMb?: number;
  /** Install Docker Engine and Compose, started on first use. Part of the template identity. */
  docker?: boolean;
  /** Minutes idle before the sandbox pauses. Runtime only. */
  idleTimeoutMinutes?: number;
}

/** Applied when neither the environment setting nor a host default is set. */
const DEFAULT_SETTINGS = { cpuCount: 2, memoryMb: 1024, docker: false, idleTimeoutMinutes: 5 } as const;

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    cpuCount: {
      type: 'integer',
      title: 'CPU',
      description: 'vCPUs for the sandbox template',
      default: DEFAULT_SETTINGS.cpuCount,
      minimum: 1,
      maximum: 64,
    },
    memoryMb: {
      type: 'integer',
      title: 'Memory',
      description: 'Memory for the sandbox template',
      default: DEFAULT_SETTINGS.memoryMb,
      // E2B caps sandbox memory at 8 GiB by default.
      oneOf: [
        { const: 512, title: '512 MB' },
        { const: 1024, title: '1 GB' },
        { const: 2048, title: '2 GB' },
        { const: 4096, title: '4 GB' },
        { const: 8192, title: '8 GB' },
      ],
    },
    docker: {
      type: 'boolean',
      title: 'Docker',
      description:
        'Install Docker Engine and Compose; the daemon starts on first use. Use at least 2 GB of memory for Docker.',
      default: DEFAULT_SETTINGS.docker,
    },
    idleTimeoutMinutes: {
      type: 'integer',
      title: 'Idle timeout (minutes)',
      description: 'Minutes idle before the sandbox pauses',
      default: DEFAULT_SETTINGS.idleTimeoutMinutes,
      minimum: 1,
      maximum: 1440,
    },
  },
  additionalProperties: false,
} as const satisfies PublicSchema;

/**
 * The settings schema with the provider's effective defaults as `default`:
 * the built-in values, overridden by the host's `idleTimeoutMinutes` option and
 * then its `defaults` option. The schema
 * is what clients show as placeholders, so it must match what the provider
 * applies when a setting is unset.
 */
function settingsSchema(
  defaults: Partial<PlatformFactorySandboxSettings> | undefined,
): PublicSchema<PlatformFactorySandboxSettings> {
  const effective = { ...DEFAULT_SETTINGS, ...defaults };
  const properties = Object.fromEntries(
    Object.entries(SETTINGS_SCHEMA.properties).map(([key, property]) => [
      key,
      { ...property, default: effective[key as keyof typeof effective] },
    ]),
  );
  return { ...SETTINGS_SCHEMA, properties } as PublicSchema<PlatformFactorySandboxSettings>;
}

export interface PlatformFactorySandboxOptions extends Omit<
  PlatformSandboxOptions,
  'id' | 'sandboxId' | 'sessionId' | 'template'
> {
  /** Options for the environment's repo template. */
  template?: {
    /** Build-only environment, excluded from template identity and runtime sandboxes. */
    buildEnv?: Record<string, string>;
  };
  /** Provider-side defaults used when a setting is unset. Never stored by factory. */
  defaults?: Partial<PlatformFactorySandboxSettings>;
}

/**
 * The platform host contract for factory: every session sandbox is a
 * {@link PlatformSandbox} whose template is {@link createRepoTemplate} over
 * the session's repositories, sized by the factory's environment settings.
 */
export class PlatformFactorySandbox extends FactorySandbox<PlatformFactorySandboxSettings> {
  readonly provider = 'platform';
  readonly settings: PublicSchema<PlatformFactorySandboxSettings>;

  readonly #options: PlatformFactorySandboxOptions;

  /**
   * Builders by template id from this process's `builds.start` calls. Platform
   * has no build status endpoint; re-calling the same builder's idempotent
   * `build()` is the status poll. After a restart earlier builds read as
   * `unknown`.
   *
   * TODO: once the platform API exposes build status and build history, read
   * `get` from the API instead of this in-memory cache and add `builds.list`.
   */
  readonly #builders = new Map<string, SandboxTemplateBuilder>();

  readonly builds: FactorySandboxBuilds<PlatformFactorySandboxSettings> = {
    start: (ctx, settings) => this.#startBuild(ctx, settings),
    get: (ctx, settings, buildId) => this.#getBuild(ctx, settings, buildId),
  };

  constructor(options: PlatformFactorySandboxOptions = {}) {
    super();
    this.#options = options;
    this.settings = settingsSchema({
      ...(options.idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes: options.idleTimeoutMinutes } : {}),
      ...options.defaults,
    });
  }

  template(
    ctx: FactorySandboxContext,
    settings: PlatformFactorySandboxSettings,
  ): PlatformRepoTemplateResolver | undefined {
    const { defaults, template } = this.#options;
    return createRepoTemplate({
      ...ctx,
      ...(template?.buildEnv ? { buildEnv: template.buildEnv } : {}),
      cpuCount: settings.cpuCount ?? defaults?.cpuCount ?? DEFAULT_SETTINGS.cpuCount,
      memoryMB: settings.memoryMb ?? defaults?.memoryMb ?? DEFAULT_SETTINGS.memoryMb,
      docker: settings.docker ?? defaults?.docker ?? DEFAULT_SETTINGS.docker,
    });
  }

  create(ctx: FactorySandboxContext, settings: PlatformFactorySandboxSettings): PlatformSandbox {
    const { defaults, template: _template, ...options } = this.#options;
    return new PlatformSandbox({
      ...options,
      id: ctx.sessionId,
      sessionId: ctx.sessionId,
      sandboxId: ctx.sandboxId,
      template: this.template(ctx, settings),
      // The template clones under this directory; the session looks for the
      // checkouts there instead of probing the VM's home.
      ...(ctx.workingDirectory ? { workingDirectory: ctx.workingDirectory } : {}),
      idleTimeoutMinutes:
        settings.idleTimeoutMinutes ??
        defaults?.idleTimeoutMinutes ??
        options.idleTimeoutMinutes ??
        DEFAULT_SETTINGS.idleTimeoutMinutes,
    });
  }

  async #startBuild(
    ctx: FactorySandboxContext,
    settings: PlatformFactorySandboxSettings,
  ): Promise<FactorySandboxBuildStart> {
    const builder = await this.#resolveBuilder(ctx, settings);
    const result = await builder.build(this.#buildOptions());
    this.#builders.set(result.templateId, builder);
    return { buildId: result.templateId, templateId: result.templateId, status: mapStatus(result.status) };
  }

  async #getBuild(
    _ctx: FactorySandboxContext,
    _settings: PlatformFactorySandboxSettings,
    buildId: string,
  ): Promise<FactorySandboxBuild> {
    const builder = this.#builders.get(buildId);
    if (!builder) {
      // Polling means submitting a build, so a build this process did not
      // start (e.g. one from before a restart) cannot be read without
      // starting a new one.
      return {
        buildId,
        status: 'unknown',
        error: `Build ${buildId} was not started by this process; its status cannot be read.`,
      };
    }
    return toBuild(await builder.build(this.#buildOptions()));
  }

  async #resolveBuilder(
    ctx: FactorySandboxContext,
    settings: PlatformFactorySandboxSettings,
  ): Promise<SandboxTemplateBuilder> {
    const builder = await this.template(ctx, settings)?.();
    if (!builder) throw new Error('PlatformFactorySandbox.builds: the session context yields no template to build');
    return builder;
  }

  #buildOptions() {
    const { defaults: _defaults, template: _template, env: _env, ...options } = this.#options;
    return options;
  }
}

function mapStatus(status: SandboxTemplateBuildResult['status']): FactorySandboxBuildStatus {
  return status;
}

function toBuild(result: SandboxTemplateBuildResult): FactorySandboxBuild {
  return {
    buildId: result.templateId,
    templateId: result.templateId,
    status: mapStatus(result.status),
    ...(result.error ? { error: result.error } : {}),
  };
}
