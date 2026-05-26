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
  const { connect: connectWorker } = await import('inngest/connect');

  return connectWorker({
    ...registerOptions,
    ...connectOptions,
    apps: [{ client: inngest, functions: appFunctions }],
  });
}
