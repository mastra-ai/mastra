import type { Mastra } from '@mastra/core/mastra';
import type { Inngest, InngestFunction, RegisterOptions } from 'inngest';
import { serve as inngestServe } from 'inngest/hono';
import { InngestWorkflow } from './workflow';

export function serve({
  mastra,
  inngest,
  functions: userFunctions = [],
  registerOptions,
}: {
  mastra: Mastra;
  inngest: Inngest;
  /**
   * Optional array of additional functions to serve and register with Inngest.
   */
  functions?: InngestFunction.Like[];
  registerOptions?: RegisterOptions;
}): ReturnType<typeof inngestServe> {
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

  return inngestServe({
    ...registerOptions,
    client: inngest,
    functions: [...workflowFunctions, ...userFunctions],
  });
}
