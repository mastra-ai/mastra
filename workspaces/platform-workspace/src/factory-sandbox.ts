import { FactorySandbox } from '@mastra/core/workspace';
import type { PublicSchema } from '@mastra/core/schema';
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

const SETTINGS_SCHEMA = {
  type: 'object',
  properties: {
    cpuCount: {
      type: 'integer',
      title: 'CPU',
      description: 'vCPUs for the sandbox template',
      minimum: 1,
      maximum: 64,
    },
    memoryMb: {
      type: 'integer',
      title: 'Memory (MB)',
      description: 'Memory in MB for the sandbox template',
      minimum: 512,
      maximum: 65536,
    },
    idleTimeoutMinutes: {
      type: 'integer',
      title: 'Idle timeout (minutes)',
      description: 'Minutes idle before the sandbox pauses',
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
    const cpuCount = settings.cpuCount ?? defaults?.cpuCount;
    const memoryMB = settings.memoryMb ?? defaults?.memoryMb;
    return createRepoTemplate({
      ...ctx,
      ...(template?.buildEnv ? { buildEnv: template.buildEnv } : {}),
      ...(cpuCount !== undefined ? { cpuCount } : {}),
      ...(memoryMB !== undefined ? { memoryMB } : {}),
    });
  }

  create(ctx: FactorySandboxContext, settings: PlatformFactorySandboxSettings): PlatformSandbox {
    const { defaults, template: _template, ...options } = this.#options;
    const idleTimeoutMinutes = settings.idleTimeoutMinutes ?? defaults?.idleTimeoutMinutes;
    return new PlatformSandbox({
      ...options,
      id: ctx.sessionId,
      sessionId: ctx.sessionId,
      sandboxId: ctx.sandboxId,
      template: this.template(ctx, settings),
      ...(idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes } : {}),
    });
  }
}
