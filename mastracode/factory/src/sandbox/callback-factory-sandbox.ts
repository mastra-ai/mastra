import type { PublicSchema } from '@mastra/core/schema';
import { BaseFactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext, MastraSandbox } from '@mastra/core/workspace';

import type { MastraFactorySandboxConfig } from './session-sandbox.js';

const NO_SETTINGS = { type: 'object', properties: {}, additionalProperties: false } as const satisfies PublicSchema;

/**
 * Wraps the deprecated `sandbox: ctx => new SomeSandbox(...)` host callback
 * as a FactorySandbox. The host owns everything inside the callback, so the
 * factory knows nothing about it: no settings, no template, no builds.
 */
export class CallbackFactorySandbox extends BaseFactorySandbox<Record<string, never>> {
  readonly provider = 'custom';
  readonly settings: PublicSchema<Record<string, never>> = NO_SETTINGS;
  readonly templateFields = [] as const;

  readonly #callback: MastraFactorySandboxConfig;

  constructor(callback: MastraFactorySandboxConfig) {
    super();
    this.#callback = callback;
  }

  create(ctx: FactorySandboxContext): MastraSandbox {
    return this.#callback(ctx);
  }
}
