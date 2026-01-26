import type { Mastra } from '@mastra/core/mastra';
import type { Inngest, InngestFunction, RegisterOptions } from 'inngest';
import { serve as inngestServeHono } from 'inngest/hono';
import { InngestWorkflow } from './workflow';

/**
 * Options for serve functions
 */
export interface MastraServeOptions {
  mastra: Mastra;
  inngest: Inngest;
  /**
   * Optional array of additional functions to serve and register with Inngest.
   */
  functions?: InngestFunction.Like[];
  registerOptions?: RegisterOptions;
}

/**
 * Type for inngest serve adapters (e.g., from inngest/hono, inngest/express, etc.)
 * Inferred from the inngest serve function signatures.
 */
export type InngestServeAdapter<THandler> = (options: {
  client: Inngest;
  functions: InngestFunction.Like[];
  [key: string]: unknown;
}) => THandler;

/**
 * Collects workflow functions from Mastra and prepares serve options for inngest.
 * This is the shared logic used by all serve functions.
 */
function prepareServeOptions({ mastra, inngest, functions: userFunctions = [], registerOptions }: MastraServeOptions) {
  const wfs = mastra.listWorkflows();

  const workflowFunctions = Array.from(
    new Set(
      Object.values(wfs).flatMap(wf => {
        if (wf instanceof InngestWorkflow) {
          wf.__registerMastra(mastra);
          return wf.getFunctions();
        }
        return [];
      }),
    ),
  );

  return {
    ...registerOptions,
    client: inngest,
    functions: [...workflowFunctions, ...userFunctions],
  };
}

/**
 * Factory function to create a serve function with any inngest adapter.
 * Use this to integrate Mastra workflows with any framework supported by inngest.
 *
 * @example Express
 * ```ts
 * import { createServe } from '@mastra/inngest';
 * import { serve } from 'inngest/express';
 *
 * const serveExpress = createServe(serve);
 * app.use('/api/inngest', serveExpress({ mastra, inngest }));
 * ```
 *
 * @example Fastify
 * ```ts
 * import { createServe } from '@mastra/inngest';
 * import { serve } from 'inngest/fastify';
 *
 * const serveFastify = createServe(serve);
 * fastify.route({
 *   method: ['GET', 'POST', 'PUT'],
 *   handler: serveFastify({ mastra, inngest }),
 *   url: '/api/inngest',
 * });
 * ```
 *
 * @example Next.js
 * ```ts
 * import { createServe } from '@mastra/inngest';
 * import { serve } from 'inngest/next';
 *
 * const serveNext = createServe(serve);
 * export const { GET, POST, PUT } = serveNext({ mastra, inngest });
 * ```
 */
export function createServe<THandler>(
  adapter: InngestServeAdapter<THandler>,
): (options: MastraServeOptions) => THandler {
  return (options: MastraServeOptions): THandler => {
    const serveOptions = prepareServeOptions(options);
    return adapter(serveOptions);
  };
}

/**
 * Serve Mastra workflows with Hono (default).
 *
 * For other frameworks, use `createServe` with the appropriate inngest adapter.
 *
 * @example
 * ```ts
 * import { serve } from '@mastra/inngest';
 *
 * app.use('/api/inngest', async (c) => {
 *   return serve({ mastra, inngest })(c);
 * });
 * ```
 */
export const serve: (options: MastraServeOptions) => ReturnType<typeof inngestServeHono> =
  createServe(inngestServeHono);
