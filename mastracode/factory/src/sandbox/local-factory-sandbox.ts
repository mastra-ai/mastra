import { join } from 'node:path';
import type { PublicSchema } from '@mastra/core/schema';
import { BaseFactorySandbox, LocalSandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';

const NO_SETTINGS = { type: 'object', properties: {}, additionalProperties: false } as const satisfies PublicSchema;

export interface LocalFactorySandboxOptions {
  /** Directory under which every session gets its own working directory. */
  root: string;
  /** Environment for commands run in the sandbox. */
  env?: Record<string, string>;
}

/**
 * Sessions run on the host machine: each session's sandbox is a LocalSandbox
 * rooted at `join(root, sessionId)`, where the repository checks out as a
 * subdirectory. No template and no user-tunable settings.
 */
export class LocalFactorySandbox extends BaseFactorySandbox<Record<string, never>> {
  readonly provider = 'local';
  readonly settings: PublicSchema<Record<string, never>> = NO_SETTINGS;
  readonly templateFields = [] as const;

  readonly #options: LocalFactorySandboxOptions;

  constructor(options: LocalFactorySandboxOptions) {
    super();
    this.#options = options;
  }

  create(ctx: FactorySandboxContext): LocalSandbox {
    return new LocalSandbox({
      workingDirectory: join(this.#options.root, ctx.sessionId),
      ...(this.#options.env ? { env: this.#options.env } : {}),
    });
  }
}
