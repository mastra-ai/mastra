import type { Mastra } from '@mastra/core/mastra';
import type { Inngest, InngestFunction, RegisterOptions } from 'inngest';
import type { connect as inngestConnect } from 'inngest/connect';
import { collectInngestFunctions } from './functions';

type InngestConnectOptions = Parameters<typeof inngestConnect>[0];

export interface MastraConnectOptions extends Omit<InngestConnectOptions, 'apps'> {
  mastra: Mastra;
  inngest: Inngest;
  /**
   * Optional array of additional Inngest functions to expose through the same Connect worker.
   */
  functions?: InngestFunction.Like[];
  /**
   * Forwarded to Inngest as part of the app registration (timeout, signing key overrides, etc.).
   *
   * When a field is present in both `registerOptions` and the top-level Connect options
   * (e.g. `signingKey`), `registerOptions` wins. This matches the override behavior of
   * `serve()` so the two surfaces stay consistent.
   */
  registerOptions?: RegisterOptions;
}

/**
 * Connect Mastra workflows to Inngest using an outbound worker connection.
 *
 * Use this instead of `serve()` when the worker process should not expose an inbound HTTP
 * endpoint. The same workflow functions collected by `serve()` are forwarded to
 * `inngest/connect`, alongside any additional user functions.
 *
 * If the Mastra instance has no `InngestWorkflow` and no additional `functions` are
 * provided, a warning is emitted because the worker would otherwise idle forever with
 * nothing to execute.
 *
 * @example Worker process
 * ```ts
 * import { connect } from '@mastra/inngest/connect';
 * import { mastra } from './mastra';
 * import { inngest } from './mastra/inngest';
 *
 * await connect({ mastra, inngest });
 * ```
 */
export async function connect(options: MastraConnectOptions) {
  const { mastra, inngest, functions, registerOptions, ...connectOptions } = options;
  const appFunctions = collectInngestFunctions({ mastra, functions });

  if (appFunctions.length === 0) {
    console.warn(
      '[@mastra/inngest] connect() was called with no Inngest workflows and no additional functions. ' +
        'The worker will connect to Inngest but has nothing to execute. ' +
        'Register at least one InngestWorkflow on the Mastra instance or pass `functions: [...]`.',
    );
  }

  const { connect: connectWorker } = await import('inngest/connect');

  return connectWorker({
    // Top-level Connect options first, then registerOptions so they take precedence
    // for any overlapping keys (e.g. `signingKey`). This matches serve()'s behavior.
    ...connectOptions,
    ...registerOptions,
    apps: [{ client: inngest, functions: appFunctions }],
  });
}
