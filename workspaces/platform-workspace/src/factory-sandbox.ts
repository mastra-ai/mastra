import type { PublicSchema } from '@mastra/core/schema';
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';

import { createRepoTemplate } from './repo-template.js';
import type { PlatformRepoTemplateResolver } from './repo-template.js';
import { PlatformSandbox } from './sandbox.js';
import type { PlatformSandboxOptions } from './sandbox.js';

/** User-tunable settings of a platform factory sandbox. Every field is optional; absent means the provider default. */
export interface PlatformFactorySandboxSettings extends Record<string, unknown> {
  /** vCPUs for the sandbox template. Part of the template identity. */
  cpuCount?: number;
  /** Memory in MB for the sandbox template. Part of the template identity. */
  memoryMb?: number;
  /** Minutes idle before the sandbox pauses. Runtime only. */
  idleTimeoutMinutes?: number;
}

/** Applied when neither the environment setting nor a host default is set. */
const DEFAULT_SETTINGS = { cpuCount: 2, memoryMb: 1024, idleTimeoutMinutes: 5 } as const;

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
      title: 'Memory (MB)',
      description: 'Memory in MB for the sandbox template',
      default: DEFAULT_SETTINGS.memoryMb,
      minimum: 512,
      maximum: 65536,
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
  readonly settings: PublicSchema<PlatformFactorySandboxSettings> = SETTINGS_SCHEMA;

  readonly #options: PlatformFactorySandboxOptions;

  constructor(options: PlatformFactorySandboxOptions = {}) {
    super();
    this.#options = options;
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
      idleTimeoutMinutes:
        settings.idleTimeoutMinutes ?? defaults?.idleTimeoutMinutes ?? DEFAULT_SETTINGS.idleTimeoutMinutes,
    });
  }
}
