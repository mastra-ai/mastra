import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext, MastraSandbox } from '@mastra/core/workspace';

import type { MastraFactorySandboxConfig } from './session-sandbox.js';

/**
 * Wraps the `sandbox: ctx => new SomeSandbox(...)` host callback
 * as a FactorySandbox. The host owns everything inside the callback, so the
 * factory knows nothing about it: no settings, no template, no builds.
 */
export class CallbackFactorySandbox extends FactorySandbox<Record<string, never>> {
  readonly provider = 'custom';

  readonly #callback: MastraFactorySandboxConfig;

  constructor(callback: MastraFactorySandboxConfig) {
    super();
    this.#callback = callback;
  }

  create(ctx: FactorySandboxContext): MastraSandbox {
    return this.#callback(ctx);
  }
}
